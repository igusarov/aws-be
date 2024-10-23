import { createProduct } from "../services/productService";
import { handler } from "./createProduct";

jest.mock('../services/productService');

test('createProduct.handler should throw an error when invalid data', () => {
  jest.mocked(createProduct).mockResolvedValue('');

  expect(handler({body: {foo: 'bar'}})).rejects.toThrow(expect.objectContaining({
    message: expect.stringContaining('Validation error'),
  }));
})
