import { getAllProducts } from "../services/productService";

export async function handler(event: any) {
  console.log('Request: ', event);

  return await getAllProducts();
}
