export const corsIntegrationResponseParameters = {
  'method.response.header.Access-Control-Allow-Origin': "'*'",
  'method.response.header.Access-Control-Allow-Methods': "'GET, OPTIONS'",
  'method.response.header.Access-Control-Allow-Headers': "'*'",
}

export const corsMethodResponseParameters = {
  'method.response.header.Access-Control-Allow-Origin': true,
  'method.response.header.Access-Control-Allow-Methods': true,
  'method.response.header.Access-Control-Allow-Headers': true,
}

export const defaultErrorIntegrationResponse = {
  statusCode: '500',
  selectionPattern: '(\n|.)+',
  responseTemplates: {
    'application/json': '{"message": "Internal server error"}',
  },
  responseParameters: corsIntegrationResponseParameters,
}

export const defaultCorsPreflightOptions =  {
  allowHeaders: ['*'],
    allowOrigins: ['*'],
    allowMethods: ['GET', 'OPTIONS'],
}
