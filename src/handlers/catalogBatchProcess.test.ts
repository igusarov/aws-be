import { SNS, PublishCommand } from "@aws-sdk/client-sns";
import { createProduct } from '../services/productService';

jest.mock("@aws-sdk/client-sns");
jest.mock('../services/productService');

const mockSnsClient = {
  send: jest.fn(),
}
// @ts-ignore
jest.mocked(SNS).mockReturnValue(mockSnsClient);

jest.spyOn(console, 'log');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('catalogBatchProcess.handler', () => {
  it('should create a product and send notification', async () => {
    const {handler} = require('./catalogBatchProcess');
    const mockProduct = {
      description: "Short Product Description1",
      id: "7567ec4b-b10c-48c5-9345-fc73c48a80aa",
      price: 24,
      title: "ProductOne",
      count: 1,
    };
    const mockEvent = {Records: [{body: JSON.stringify(mockProduct)}]};
    await handler(mockEvent);

    expect(createProduct).toHaveBeenCalledWith(mockProduct);
    expect(console.log).not.toHaveBeenCalled();
    expect(mockSnsClient.send).toHaveBeenCalledTimes(1);
    expect(PublishCommand).toHaveBeenCalledWith(expect.objectContaining({
      Message: `
        title: ${mockProduct.title}
        description: ${mockProduct.description}
        count: ${mockProduct.count}
        price: ${mockProduct.price}
      `
    }));
  })

  it('should handle creation product error', async () => {
    const {handler} = require('./catalogBatchProcess');
    const mockProduct = {
      description: "Short Product Description1",
      id: "7567ec4b-b10c-48c5-9345-fc73c48a80aa",
      price: 24,
      title: "ProductOne",
      count: 1,
    };
    const mockEvent = {Records: [{body: JSON.stringify(mockProduct)}]};

    jest.mocked(createProduct).mockRejectedValue('mock error');
    await handler(mockEvent);

    expect(createProduct).toHaveBeenCalledWith(mockProduct);
    expect(console.log).toHaveBeenCalledWith('unable to create a product', {body: JSON.stringify(mockProduct)}, 'mock error');
    expect(mockSnsClient.send).not.toHaveBeenCalled();
  });
})
