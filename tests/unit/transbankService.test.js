const transbankService = require('../../src/services/transbankService');

describe('TransbankService', () => {
  beforeEach(() => {
    process.env.TRANSBANK_ENVIRONMENT = 'integration';
    process.env.TRANSBANK_COMMERCE_CODE = '597055555532';
    process.env.TRANSBANK_API_KEY = 'test_key';
  });

  describe('crearTransaccion', () => {
    it('debería crear una transacción exitosamente', async () => {
      const transactionData = {
        buyOrder: 'TEST-123',
        sessionId: 'SES-123',
        amount: 50000,
        returnUrl: 'http://localhost:4200/return'
      };

      const result = await transbankService.crearTransaccion(transactionData);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('url');
      expect(result.token).toMatch(/^SIMU_/);
    });

    it('debería fallar con datos inválidos', async () => {
      const transactionData = {
        buyOrder: '',
        amount: 0,
        returnUrl: 'invalid-url'
      };

      await expect(transbankService.crearTransaccion(transactionData))
        .rejects.toThrow('Faltan datos requeridos');
    });
  });

  describe('confirmarTransaccion', () => {
    it('debería confirmar una transacción exitosamente', async () => {
      const token = 'SIMU_1234567890_TEST';
      
      const result = await transbankService.confirmarTransaccion(token);

      expect(result).toHaveProperty('response_code', 0);
      expect(result).toHaveProperty('authorization_code');
      expect(result).toHaveProperty('card_detail');
    });

    it('debería fallar con token inválido', async () => {
      await expect(transbankService.confirmarTransaccion(''))
        .rejects.toThrow('Token requerido');
    });
  });

  describe('verificarConfiguracion', () => {
    it('debería verificar configuración válida', () => {
      expect(() => transbankService.verificarConfiguracion())
        .not.toThrow();
    });

    it('debería fallar con configuración incompleta', () => {
      delete process.env.TRANSBANK_COMMERCE_CODE;
      
      expect(() => transbankService.verificarConfiguracion())
        .toThrow('Configuración incompleta');
    });
  });
});
