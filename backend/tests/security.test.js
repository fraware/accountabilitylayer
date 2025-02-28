const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const logRoutes = require('../src/routes/logRoutes');
const { verifyToken } = require('../src/middleware/auth');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'testsecret';

const token = jwt.sign({ username: 'auditor1', role: 'auditor' }, process.env.JWT_SECRET, { expiresIn: '1h' });

const app = express();
app.use(bodyParser.json());
app.use('/api/v1', verifyToken);
app.use('/api/v1', logRoutes);

describe('Security Tests', () => {
  it('should reject requests with no token', (done) => {
    request(app)
      .get('/api/v1/logs/agent_test')
      .expect(401, done);
  });

  it('should reject requests with invalid token', (done) => {
    request(app)
      .get('/api/v1/logs/agent_test')
      .set('Authorization', 'Bearer invalidtoken')
      .expect(401, done);
  });

});