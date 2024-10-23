import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const bucketName = process.env.BUCKET_NAME as string;

export async function handler(event: any) {
  const key  = `uploaded/${event.filename}`;
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn: 3600 });
}
