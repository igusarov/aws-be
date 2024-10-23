import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { products } from '../../mocks/data';

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const productTable = process.env.PRODUCT_TABLE as string;
const stockTable = process.env.STOCK_TABLE as string;

export const handler = async () => {
  try {
    for (const { id, description, title, price, count } of products) {
      const insertProductCommand = new PutItemCommand({
        TableName: productTable,
        Item: {
          id: { S: id},
          description: { S: description },
          title: { S: title },
          price: { N: `${price}` },
        }
      });

      const insertStockCommand = new PutItemCommand({
        TableName: stockTable,
        Item: {
          product_id: { S: id},
          count: { N: `${count}` },
        }
      });

      const result = await Promise.all([dynamoDB.send(insertProductCommand), dynamoDB.send(insertStockCommand)]);

      console.log('PutProduct succeeded:', JSON.stringify(result, null, 2));
    }

    return "Products were successfully inserted";
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Error adding products to DynamoDB');
  }
};
