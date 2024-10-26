import * as cdk from 'aws-cdk-lib';
import { aws_s3 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as nodeJsLambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as notifications from "aws-cdk-lib/aws-s3-notifications";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import {
  corsIntegrationResponseParameters,
  corsMethodResponseParameters,
  defaultCorsPreflightOptions,
  defaultErrorIntegrationResponse
} from "./constants";
import { HttpMethods } from "aws-cdk-lib/aws-s3";
import { ProductServiceStack } from "./product-service-stack";

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, productServiceStack: ProductServiceStack, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new aws_s3.Bucket(this, 'ImportServiceBucket', {
      cors: [{
        allowedHeaders: ["*"],
        allowedMethods: [HttpMethods.GET, HttpMethods.PUT, HttpMethods.POST],
        allowedOrigins: ["*"],
        exposedHeaders: ["ETag"],
        maxAge: 3000
      }],
      blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const importProductsFileLambda = new nodeJsLambda.NodejsFunction(this, 'ImportProductsFileLambda', {
      entry: path.join(__dirname, '../src/handlers/importProductsFile.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'handler',
      environment: {
        BUCKET_NAME: bucket.bucketName,
      }
    });

    const importFileParserLambda = new nodeJsLambda.NodejsFunction(this, 'ImportFileParserLambda', {
      entry: path.join(__dirname, '../src/handlers/importFileParser.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'handler',
      environment: {
        BUCKET_NAME: bucket.bucketName,
        CATALOG_ITEMS_QUEUE_URL: productServiceStack.catalogItemsQueue.queueUrl,
      }
    });

    bucket.grantWrite(importProductsFileLambda);
    bucket.grantReadWrite(importFileParserLambda);
    bucket.grantDelete(importFileParserLambda);
    productServiceStack.catalogItemsQueue.grantSendMessages(importFileParserLambda);

    bucket.addObjectCreatedNotification(new notifications.LambdaDestination(importFileParserLambda), {
      prefix: 'uploaded/',
    });

    const api = new apigateway.RestApi(this, "ImportServiceApi", {
      restApiName: "Import Service",
      description: "This service imports products.",
      defaultCorsPreflightOptions,
    });

    const importResource = api.root.addResource('import');

    importResource.addMethod('GET', new apigateway.LambdaIntegration(importProductsFileLambda, {
      requestTemplates: {
        'application/json': `{ "filename": "$input.params('filename')" }`
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: corsIntegrationResponseParameters,
        },
        defaultErrorIntegrationResponse,
      ],
      proxy: false,
    }), {
      requestParameters: {
        'method.request.querystring.filename': true,
      },
      requestValidatorOptions: {
        validateRequestParameters: true,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: corsMethodResponseParameters,
        },
        {
          statusCode: '500',
          responseParameters: corsMethodResponseParameters,
        }
      ]
    });
  }
}
