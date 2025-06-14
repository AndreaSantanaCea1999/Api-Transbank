const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Transbank FERREMAS',
      version: '1.0.0',
      description: 'API para integración con WebPay y gestión de pagos electrónicos',
      contact: {
        name: 'Equipo FERREMAS',
        email: 'soporte@ferremas.cl',
        url: 'https://ferremas.cl'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3002/api',
        description: 'Servidor de desarrollo'
      },
      {
        url: 'https://api-transbank.ferremas.cl/api',
        description: 'Servidor de producción'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      },
      schemas: {
        Transaction: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'Token único de la transacción'
            },
            ordenCompra: {
              type: 'string',
              description: 'Número de orden de compra'
            },
            monto: {
              type: 'number',
              description: 'Monto de la transacción en pesos'
            },
            estado: {
              type: 'string',
              enum: ['INIT', 'PEND', 'AUTH', 'FAIL', 'CANC']
            }
          }
        },
        Product: {
          type: 'object',
          properties: {
            idProducto: {
              type: 'integer',
              description: 'ID del producto'
            },
            cantidad: {
              type: 'integer',
              minimum: 1,
              description: 'Cantidad del producto'
            },
            precioUnitario: {
              type: 'number',
              minimum: 0.01,
              description: 'Precio unitario del producto'
            },
            descripcion: {
              type: 'string',
              description: 'Descripción del producto'
            }
          },
          required: ['idProducto', 'cantidad', 'precioUnitario']
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: 'Mensaje de error'
            },
            code: {
              type: 'string',
              description: 'Código de error'
            },
            errors: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Lista detallada de errores'
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js'], // Paths a los archivos con anotaciones
};

const specs = swaggerJsdoc(options);

const swaggerOptions = {
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 50px 0; }
    .swagger-ui .info .title { color: #1976d2; }
  `,
  customSiteTitle: 'API Transbank FERREMAS - Documentación'
};

module.exports = {
  serve: swaggerUi.serve,
  setup: swaggerUi.setup(specs, swaggerOptions),
  specs
};
