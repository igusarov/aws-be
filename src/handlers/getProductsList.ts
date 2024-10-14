import { getAllProducts } from "../services/productService";

export async function handler() {
  return await getAllProducts();
}
