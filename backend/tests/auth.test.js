const request = require('supertest');
const express = require('express');

process.env.JWT_SECRET = 'testsecret';

const authMod = require('../src/routes/authRoutes');
const authRoutes = authMod.default ?? authMod;

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

describe('Authentication API', () => {
  it('should return a token for valid credentials', (done) => {
    request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'auditor1', password: 'password' })
      .expect(200)
      .expect((res) => {
        if (!res.body.token) throw new Error('Missing token');
      })
      .end(done);
  });

  it('should return 401 for invalid credentials', (done) => {
    request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'auditor1', password: 'wrongpassword' })
      .expect(401)
      .end(done);
  });
});
