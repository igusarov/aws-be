import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeJsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from 'constructs';

const PRODUCT_TABLE = 'PRODUCT';
const STOCK_TABLE = 'STOCK_TABLE';

const createLambdaFunctionHelper = (context: cdk.Stack, id: string, entry: string) => new nodeJsLambda.NodejsFunction(context, id, {
  entry,
  runtime: lambda.Runtime.NODEJS_20_X,
  memorySize: 1024,
  timeout: cdk.Duration.seconds(5),
  handler: 'handler',
  environment: {
    PRODUCT_TABLE,
    STOCK_TABLE,
  },
});

const corsIntegrationResponseParameters = {
  'method.response.header.Access-Control-Allow-Origin': "'*'",
  'method.response.header.Access-Control-Allow-Methods': "'GET, OPTIONS'",
  'method.response.header.Access-Control-Allow-Headers': "'*'",
}

const corsMethodResponseParameters = {
  'method.response.header.Access-Control-Allow-Origin': true,
  'method.response.header.Access-Control-Allow-Methods': true,
  'method.response.header.Access-Control-Allow-Headers': true,
}

const defaultErrorIntegrationResponse = {
  statusCode: '500',
  selectionPattern: '(\n|.)+',
  responseTemplates: {
    'application/json': '{"message": "Internal server error"}',
  },
  responseParameters: corsIntegrationResponseParameters,
}

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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


    const fillDBLambda = createLambdaFunctionHelper(this, 'FillDbLambda', path.join(__dirname, '../src/handlers/utils/fillDb.ts'));
    const getProductsLambda = createLambdaFunctionHelper(this, 'GetProductsLambda', path.join(__dirname, '../src/handlers/getProductsList.ts'));
    const getProductsByIdLambda = createLambdaFunctionHelper(this, 'GetProductsByIdLambda', path.join(__dirname, '../src/handlers/getProductsById.ts'));
    const createProductLambda = createLambdaFunctionHelper(this, 'CreateProductLambda', path.join(__dirname, '../src/handlers/createProduct.ts'));

    productTable.grantWriteData(fillDBLambda);
    stockTable.grantWriteData(fillDBLambda);
    productTable.grantReadData(getProductsLambda);
    stockTable.grantReadData(getProductsLambda);
    productTable.grantReadData(getProductsByIdLambda);
    stockTable.grantReadData(getProductsByIdLambda);
    productTable.grantWriteData(createProductLambda);
    stockTable.grantWriteData(createProductLambda);

    const api = new apigateway.RestApi(this, "ProductsApi", {
      restApiName: "Products Service",
      description: "This service serves products.",
      defaultCorsPreflightOptions: {
        allowHeaders: ['*'],
        allowOrigins: ['*'],
        allowMethods: ['GET', 'OPTIONS'],
      }
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
