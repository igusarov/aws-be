import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import { Construct } from 'constructs';

const createLambdaFunctionHelper = (context: cdk.Stack, id: string, handler: string) => new lambda.Function(context, id, {
  runtime: lambda.Runtime.NODEJS_20_X,
  memorySize: 1024,
  timeout: cdk.Duration.seconds(5),
  handler: handler,
  code: lambda.Code.fromAsset(path.join(__dirname, '../src')),
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

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const getProductsLambda = createLambdaFunctionHelper(this, 'GetProductsLambda', 'handlers/getProductsList.handler');
    const getProductsByIdLambda = createLambdaFunctionHelper(this, 'GetProductsByIdLambda', 'handlers/getProductsById.handler');

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
        }
      ],
      proxy: false,
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: corsMethodResponseParameters,
      }]
    });

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
        }
      ],
      proxy: false,
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: corsMethodResponseParameters
      }, {
        statusCode: '404',
        responseParameters: corsMethodResponseParameters
      }]
    });
  }
}
