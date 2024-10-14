import { getProductById } from "../services/productService";

export async function handler(event: any) {
  const { id } = event;
  const product =  await getProductById(id);

  if (!product) {
    throw new Error('Product not found');
  }

  return product;
}
