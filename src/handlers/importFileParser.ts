import { S3Event } from "aws-lambda";
import { Readable } from 'stream';
import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { SQS, SendMessageCommand } from "@aws-sdk/client-sqs";
import csv = require('csv-parser');

const s3 = new S3Client({region: process.env.AWS_REGION});
const sqs = new SQS({region: process.env.AWS_REGION});

const CATALOG_ITEMS_QUEUE_URL = process.env.CATALOG_ITEMS_QUEUE_URL;

const getReadableStream = (webStream: ReadableStream) => new Readable({
  async read() {
    const reader = webStream.getReader();

    const processStream = async () => {
      while (true) {
        const {done, value} = await reader.read();
        if (done) {
          this.push(null);
          break;
        }
        this.push(Buffer.from(value));
      }
    };

    try {
      await processStream();
    } catch (error) {
        console.error('Error processing web stream:', error);
        this.destroy(error as any);
    }
  },
});

const sendParsedRowToSqs = async (row: any) => {
  try {
    const product = {
      ...row,
      price: Number(row.price),
      count: Number(row.count),
    }
    const result = await sqs.send(new SendMessageCommand({
      QueueUrl: CATALOG_ITEMS_QUEUE_URL,
      MessageBody: JSON.stringify(product),
    }));

    if (!result.MessageId) {
      throw new Error(`MessageId is undefined, result: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    console.log('Unable to send parsed row to sqs:', row, error);
  }
}

export async function handler(event: S3Event) {
  for (const record of event.Records) {
    const objectData = await s3.send(new GetObjectCommand({
      Bucket: record.s3.bucket.name,
      Key: record.s3.object.key,
    }));

    if (!objectData?.Body) {
      throw new Error('Object not found');
    }

    await new Promise((resolve, reject) => {
      getReadableStream(objectData?.Body!.transformToWebStream())
        .pipe(csv({separator: ';'}))
        .on('data', sendParsedRowToSqs)
        .on('end', resolve)
        .on('error', reject)
    });

    await s3.send(new CopyObjectCommand({
      Bucket: record.s3.bucket.name,
      CopySource: `${record.s3.bucket.name}/${record.s3.object.key}`,
      Key: record.s3.object.key.replace('uploaded/', 'parsed/'),
    }));

    await s3.send(new DeleteObjectCommand({
      Bucket: record.s3.bucket.name,
      Key: record.s3.object.key,
    }))
  }
}
