import { APIGatewayAuthorizerResult, APIGatewayTokenAuthorizerEvent } from "aws-lambda";

const LOGIN = process.env.LOGIN;
const PASSWORD = process.env.PASSWORD;

export async function handler (event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
  console.log(`login: ${LOGIN}, passwd: ${PASSWORD}`);
  const [login, password] = Buffer
    .from(event.authorizationToken.split(' ')[1], 'base64')
    .toString()
    .split(':');


    const Effect = login === LOGIN && password === PASSWORD ? 'Allow' : 'Deny';

    return {
      principalId: login,
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect,
            Resource: event.methodArn,
          }
        ]
      }
    }
}
