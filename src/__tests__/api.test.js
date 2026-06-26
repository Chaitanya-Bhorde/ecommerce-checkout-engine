const request = require('supertest');
const app = require('../app');

// Test basic API functionality (no DB required)
describe('API Basic Tests', () => {
  // Test 1: Health Check
  describe('GET /api/health', () => {
    it('should return 200 OK', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('OK');
    });
  });

  // Test 2: Protected routes (no DB needed — just token check)
  describe('GET /api/auth/me', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });
  });

  // Test 3: Cart protected route
  describe('GET /api/cart', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/cart');
      expect(res.statusCode).toBe(401);
    });
  });

  // Test 4: Order protected route
  describe('POST /api/orders', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).post('/api/orders').send({});
      expect(res.statusCode).toBe(401);
    });
  });

  // Test 5: Payment protected route
  describe('GET /api/payments/ledger', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/payments/ledger');
      expect(res.statusCode).toBe(401);
    });
  });

  // Test 6: Invalid route
  describe('GET /api/invalid', () => {
    it('should return 404', async () => {
      const res = await request(app).get('/api/invalid');
      expect(res.statusCode).toBe(404);
    });
  });
});