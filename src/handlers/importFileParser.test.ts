import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { ReadableStream } from "web-streams-polyfill";
import { S3Event } from "aws-lambda";

jest.mock("@aws-sdk/client-s3");

const mockS3Client = {
  send: jest.fn((command) => {
    if (command instanceof GetObjectCommand) {
      return Promise.resolve({
        Body: {
          transformToWebStream: () => mockWebStream,
        }
      });
    }

    return Promise.resolve();
  }),
}

const mockFileData = "description;id;price;title;count\nShort Product Description1;7567ec4b-b10c-48c5-9345-fc73c48a80df;24;ProductOne;1";

const mockWebStream = new ReadableStream({
  start(controller) {
    controller.enqueue(mockFileData);
    controller.close();
  }
})

const mockS3Event: S3Event = {
  Records: [
    {
      eventVersion: "",
      eventSource: "",
      awsRegion: "",
      eventTime: "",
      eventName: "",
      userIdentity: {
        principalId: "",
      },
      requestParameters: {
        sourceIPAddress: "",
      },
      responseElements: {
        "x-amz-request-id": "",
        "x-amz-id-2": "",
      },
      s3: {
        bucket: {
          name: 'mockBucketName',
          ownerIdentity: {
            principalId: ""
          },
          arn: ""
        },
        object: {
          key: 'uploaded/mockObjectKey',
          size: 0,
          eTag: "",
          sequencer: ""
        },
        s3SchemaVersion: "",
        configurationId: ""
      }
    }
  ]
};

jest.spyOn(console, 'log');

// @ts-ignore
jest.mocked(S3Client).mockReturnValue(mockS3Client);

describe('importFileParser.handler', () => {
  it('should process csv file and move it to the parsed folder', async () => {
    const { handler } = require('./importFileParser');

    await handler(mockS3Event);

    expect(console.log).toBeCalledWith('Parsed Row:', {
      description: 'Short Product Description1',
      id: '7567ec4b-b10c-48c5-9345-fc73c48a80df',
      price: '24',
      title: 'ProductOne',
      count: '1'
    });

    expect(mockS3Client.send).toHaveBeenNthCalledWith(1, expect.any(GetObjectCommand));
    expect(mockS3Client.send).toHaveBeenNthCalledWith(2, expect.any(CopyObjectCommand));
    expect(mockS3Client.send).toHaveBeenNthCalledWith(3, expect.any(DeleteObjectCommand));

    expect(GetObjectCommand).toBeCalledWith({
      Bucket: 'mockBucketName',
      Key: 'uploaded/mockObjectKey'
    })

    expect(CopyObjectCommand).toBeCalledWith({
      Bucket: 'mockBucketName',
      CopySource: 'mockBucketName/uploaded/mockObjectKey',
      Key: 'parsed/mockObjectKey'
    })

    expect(DeleteObjectCommand).toBeCalledWith({
      Bucket: 'mockBucketName',
      Key: 'uploaded/mockObjectKey'
    })
  });

  it('should throw Object not found', async () => {
    // @ts-ignore
    mockS3Client.send.mockResolvedValue({});

    const { handler } = require('./importFileParser');

    await expect(handler(mockS3Event)).rejects.toThrow('Object not found');
  })
});
