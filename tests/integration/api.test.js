const request = require('supertest');
const app = require('../../src/app');

describe('API Integration Tests', () => {
  describe('Health Check', () => {
    it('GET /api/health should return OK', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Transbank Endpoints', () => {
    it('POST /api/transbank/init should create transaction', async () => {
      const transactionData = {
        monto: 50000,
        productos: [
          {
            idProducto: 1,
            cantidad: 1,
            precioUnitario: 50000,
            descripcion: 'Producto Test'
          }
        ],
        returnUrl: 'http://localhost:4200/return',
        sessionId: 'TEST-SESSION'
      };

      const response = await request(app)
        .post('/api/transbank/init')
        .send(transactionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('url');
    });

    it('POST /api/transbank/init should fail with invalid data', async () => {
      const invalidData = {
        monto: 0,
        productos: []
      };

      const response = await request(app)
        .post('/api/transbank/init')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to transactions', async () => {
      const transactionData = {
        monto: 50000,
        productos: [
          {
            idProducto: 1,
            cantidad: 1,
            precioUnitario: 50000,
            descripcion: 'Test'
          }
        ],
        returnUrl: 'http://localhost:4200/return',
        sessionId: 'RATE-TEST'
      };

      // Hacer múltiples requests para activar rate limiting
      const requests = Array(15).fill().map(() => 
        request(app)
          .post('/api/transbank/init')
          .send(transactionData)
      );

      const responses = await Promise.allSettled(requests);
      
      // Al menos una respuesta debería ser 429 (rate limited)
      const rateLimited = responses.some(result => 
        result.value?.status === 429
      );
      
      expect(rateLimited).toBe(true);
    });
  });
});