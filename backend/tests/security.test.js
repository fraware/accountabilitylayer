const request = require('supertest');
const express = require('express');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'testsecret';

const eventBus = require('../src/services/eventBus');
sinon.stub(eventBus, 'publish').resolves({
  id: 'e1',
  sequence: 1,
  timestamp: new Date().toISOString(),
});

const logMod = require('../src/routes/logRoutes');
const logRoutes = logMod.default ?? logMod;
const { verifyToken } = require('../src/middleware/auth');

const token = jwt.sign(
  { username: 'auditor1', role: 'auditor' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const app = express();
app.use(express.json());
app.use('/api/v1', verifyToken);
app.use('/api/v1', logRoutes);

describe('Security Tests', () => {
  after(() => {
    sinon.restore();
  });

  it('should reject requests with no token', (done) => {
    request(app).get('/api/v1/logs/agent_test').expect(401, done);
  });

  it('should reject requests with invalid token', (done) => {
    request(app)
      .get('/api/v1/logs/agent_test')
      .set('Authorization', 'Bearer invalidtoken')
      .expect(401, done);
  });

  it('should accept requests with valid token', (done) => {
    request(app)
      .get('/api/v1/logs/agent_test')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, done);
  });
});
