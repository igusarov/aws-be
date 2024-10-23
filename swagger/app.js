const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = process.env.service === 'product' ?
  require('./productService.json') :
  require('./importService.json');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(3000, () => {
  console.log('API documentation available at http://localhost:3000/api-docs');
});
