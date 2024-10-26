import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeJsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from 'constructs';
import {
  corsIntegrationResponseParameters,
  corsMethodResponseParameters,
  defaultCorsPreflightOptions, defaultErrorIntegrationResponse
} from "./constants";

const PRODUCT_TABLE = 'PRODUCT';
const STOCK_TABLE = 'STOCK_TABLE';

const createLambdaFunctionHelper = (context: cdk.Stack, id: string, entry: string, environment: Record<string, string>) => new nodeJsLambda.NodejsFunction(context, id, {
  entry,
  runtime: lambda.Runtime.NODEJS_20_X,
  memorySize: 1024,
  timeout: cdk.Duration.seconds(5),
  handler: 'handler',
  environment,
});

export class ProductServiceStack extends cdk.Stack {

  catalogItemsQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue');

    const createProductTopic = new sns.Topic(this, 'CreateProductTopic')

    const productTable = new dynamodb.Table(this, 'ProductTable', {
      partitionKey: {name: 'id', type: dynamodb.AttributeType.STRING},
      tableName: PRODUCT_TABLE,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const stockTable = new dynamodb.Table(this, 'StockTable', {
      partitionKey: {name: 'product_id', type: dynamodb.AttributeType.STRING},
      tableName: STOCK_TABLE,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });


    const fillDBLambda = createLambdaFunctionHelper(this, 'FillDbLambda', path.join(__dirname, '../src/handlers/utils/fillDb.ts'), {
      PRODUCT_TABLE,
      STOCK_TABLE,
    });
    const getProductsLambda = createLambdaFunctionHelper(this, 'GetProductsLambda', path.join(__dirname, '../src/handlers/getProductsList.ts'), {
      PRODUCT_TABLE,
      STOCK_TABLE,
    });
    const getProductsByIdLambda = createLambdaFunctionHelper(this, 'GetProductsByIdLambda', path.join(__dirname, '../src/handlers/getProductsById.ts'), {
      PRODUCT_TABLE,
      STOCK_TABLE,
    });
    const createProductLambda = createLambdaFunctionHelper(this, 'CreateProductLambda', path.join(__dirname, '../src/handlers/createProduct.ts'), {
      PRODUCT_TABLE,
      STOCK_TABLE,
    });
    const catalogBatchProcessLambda = createLambdaFunctionHelper(this, 'CatalogBatchProcessLambda', path.join(__dirname, '../src/handlers/catalogBatchProcess.ts'), {
      PRODUCT_TABLE,
      STOCK_TABLE,
      CREATE_PRODUCT_TOPIC_ARN: createProductTopic.topicArn,
    });


    catalogBatchProcessLambda.addEventSource(new SqsEventSource(this.catalogItemsQueue, {batchSize: 5}));

    productTable.grantWriteData(fillDBLambda);
    stockTable.grantWriteData(fillDBLambda);
    productTable.grantReadData(getProductsLambda);
    stockTable.grantReadData(getProductsLambda);
    productTable.grantReadData(getProductsByIdLambda);
    stockTable.grantReadData(getProductsByIdLambda);
    productTable.grantWriteData(createProductLambda);
    stockTable.grantWriteData(createProductLambda);
    productTable.grantWriteData(catalogBatchProcessLambda);
    stockTable.grantWriteData(catalogBatchProcessLambda);

    createProductTopic.addSubscription(new subscriptions.EmailSubscription('ilya_gusarov@epam.com'));
    createProductTopic.addSubscription(new subscriptions.EmailSubscription('i.gusarov86@gmail.com', {
      filterPolicy: {
        price: sns.SubscriptionFilter.numericFilter({
          greaterThan: 100,
        }),
      }
    }));
    createProductTopic.grantPublish(catalogBatchProcessLambda);

    const api = new apigateway.RestApi(this, "ProductsApi", {
      restApiName: "Products Service",
      description: "This service serves products.",
      defaultCorsPreflightOptions,
    });

    const productsResource = api.root.addResource('products');
    const productByIdResource = productsResource.addResource('{id}');


    productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsLambda, {
      requestTemplates: {
        'application/json': `{}`
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

    productsResource.addMethod('POST', new apigateway.LambdaIntegration(createProductLambda, {
      requestTemplates: {
        'application/json': `{
          "body": $input.json('$')
        }`
      },
      integrationResponses: [
        {
          statusCode: '201',
          responseParameters: corsIntegrationResponseParameters,
        },
        {
          statusCode: '400',
          selectionPattern: "^Validation error:.*$",
          responseTemplates: {
            'application/json': '{"message": "$input.path(\'$.errorMessage\')"}',
          },
          responseParameters: corsIntegrationResponseParameters,
        },
        defaultErrorIntegrationResponse,
      ],
      proxy: false,
    }), {
      methodResponses: [
        {
          statusCode: '201',
          responseParameters: corsMethodResponseParameters,
        },
        {
          statusCode: '400',
          responseParameters: corsMethodResponseParameters,
        },
        {
          statusCode: '500',
          responseParameters: corsMethodResponseParameters,
        }
      ]
    })

    productByIdResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsByIdLambda, {
      requestTemplates: {
        'application/json': `{ "id": "$input.params('id')" }`
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: corsIntegrationResponseParameters,
        },
        {
          statusCode: '404',
          selectionPattern: 'Product not found',
          responseTemplates: {
            'application/json': '{"message": "Product not found"}',
          },
          responseParameters: corsIntegrationResponseParameters,
        },
        defaultErrorIntegrationResponse,
      ],
      proxy: false,
    }), {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: corsMethodResponseParameters
        }, {
          statusCode: '404',
          responseParameters: corsMethodResponseParameters
        },
        {
          statusCode: '500',
          responseParameters: corsMethodResponseParameters,
        }
      ]
    });
  }
}
