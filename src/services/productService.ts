import { Product } from "../types/productTypes";
import { products } from "../mocks/data";

export const getAllProducts = async (): Promise<Product[]> => {
  return products;
}

export const getProductById = async (id: string): Promise<Product | undefined> => {
  return products.find((product) => product.id === id);
}
