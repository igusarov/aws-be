import * as yup from 'yup';
import { createProduct } from "../services/productService";

const productSchema = yup.object().shape({
  title: yup.string().required('Product title is required').min(3, 'Title must be at least 3 characters'),
  description: yup.string().optional(),
  price: yup.number().required('Price is required').positive('Price must be a positive number'),
  count: yup.number().required('Count is required').positive('Count must be a positive number'),
});

export async function handler(event: any) {
  console.log('Request: ', event);

  const product = event.body;

  try {
    await productSchema.validate(product);
  } catch (error) {
    throw new Error(`Validation error: ${(error as any).message}`);
  }

  return await createProduct(product);
}
