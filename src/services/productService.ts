import { CreateProductPayload, Product, ProductWithStock } from "../types/productTypes";
import { v4 as uuidv4 } from 'uuid';
import {
  AttributeValue,
  DynamoDBClient,
  GetItemCommand,
  ScanCommand,
  TransactWriteItemsCommand,
  TransactWriteItemsCommandInput
} from "@aws-sdk/client-dynamodb";

const dynamoDB = new DynamoDBClient({region: process.env.AWS_REGION});
const productTable = process.env.PRODUCT_TABLE as string;
const stockTable = process.env.STOCK_TABLE as string;

const mapToProduct = (item: Record<string, AttributeValue>): Product => ({
  id: item.id.S!,
  title: item.title.S!,
  description: item.description.S!,
  price: Number(item.price.N),
});

const joinStockToProduct = async (product: Product): Promise<ProductWithStock> => {
  const getStockCommand = new GetItemCommand({
    TableName: stockTable,
    Key: {
      product_id: {S: product.id}
    }
  });

  const stockData = await dynamoDB.send(getStockCommand);

  return {
    ...product,
    count: Number(stockData.Item?.count.N),
  }
}

export const getAllProducts = async (): Promise<ProductWithStock[]> => {
  const scanProductCommand = new ScanCommand({
    TableName: productTable,
  });

  const productData = await dynamoDB.send(scanProductCommand);
  const products = (productData.Items || []).map<Product>(mapToProduct);

  return await Promise.all(products.map(joinStockToProduct));
}

export const getProductById = async (id: string): Promise<Product | undefined> => {
  const getProductCommand = new GetItemCommand({
    TableName: productTable,
    Key: {
      id: {S: id}
    }
  });

  const productData = await dynamoDB.send(getProductCommand);
  if (!productData.Item) {
    return undefined;
  }

  const product = mapToProduct(productData.Item);

  return await joinStockToProduct(product);
}

export const createProduct = async (product: CreateProductPayload) => {
  const productId = uuidv4();
  const params: TransactWriteItemsCommandInput = {
    TransactItems: [
      {
        Put: {
          TableName: productTable,
          Item: {
            id: { S: productId },
            title: { S: product.title },
            description: { S: product.description },
            price: { N: product.price.toString() },
          },
        },
      },
      {
        Put: {
          TableName: stockTable,
          Item: {
            product_id: { S: productId },
            count: { N: product.count.toString() },
          },
        },
      },
    ],
  };
  const transactWriteProductCommand = new TransactWriteItemsCommand(params);

  await dynamoDB.send(transactWriteProductCommand);

  return productId;
}
