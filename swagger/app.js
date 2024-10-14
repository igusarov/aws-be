const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const swaggerDocument = require('./swagger.json')

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(3000, () => {
  console.log('API documentation available at http://localhost:3000/api-docs');
});
