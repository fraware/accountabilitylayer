// backend/tests/log.test.js
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const logRoutes = require('../src/routes/logRoutes');
const { verifyToken } = require('../src/middleware/auth');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'testsecret';

// Generate a test token (role: auditor).
const token = jwt.sign({ username: 'auditor1', role: 'auditor' }, process.env.JWT_SECRET, { expiresIn: '1h' });

const app = express();
app.use(bodyParser.json());
app.use('/api/v1', verifyToken);
app.use('/api/v1', logRoutes);

describe('Log API Endpoints', () => {
  it('should create a log (POST /logs)', (done) => {
    request(app)
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        agent_id: 'agent_test',
        step_id: 1,
        input_data: { test: 'data' },
        output: { result: 'ok' },
        reasoning: 'Test log creation with sufficient details'
      })
      .expect(201)
      .end(done);
  });

  it('should update a log review status (PUT /logs/:agent_id/:step_id)', (done) => {
    // Create a log that triggers anomaly detection (reasoning too short)
    request(app)
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        agent_id: 'agent_test',
        step_id: 2,
        input_data: { test: 'data' },
        output: { result: 'error' },
        reasoning: 'error found', // Triggers anomaly detection
        trace_id: 'trace_123'
      })
      .expect(201)
      .end((err, res) => {
        if (err) return done(err);
        // Update the log review status (only auditors/admins allowed).
        request(app)
          .put('/api/v1/logs/agent_test/2')
          .set('Authorization', `Bearer ${token}`)
          .send({
            reviewed: true,
            review_comments: 'Reviewed by auditor.'
          })
          .expect(200)
          .end(done);
      });
  });

  it('should search logs with filters (GET /logs/search)', (done) => {
    request(app)
      .get('/api/v1/logs/search?agent_id=agent_test&status=anomaly')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        if (!Array.isArray(res.body.data)) throw new Error("Data is not an array");
      })
      .end(done);
  });

  it('should return a summary of logs (GET /logs/summary/:agent_id)', (done) => {
    request(app)
      .get('/api/v1/logs/summary/agent_test')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        const summary = res.body.data;
        if (typeof summary.totalLogs !== 'number') throw new Error("Missing totalLogs in summary");
      })
      .end(done);
  });
});
