export type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
}

export type ProductWithStock = Product & { count: number };

export type CreateProductPayload = Omit<ProductWithStock, 'id'>;
