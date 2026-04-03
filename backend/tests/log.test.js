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
const Log = require('../src/models/logModel');

const token = jwt.sign(
  { username: 'auditor1', role: 'auditor' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const app = express();
app.use(express.json());
app.use('/api/v1', verifyToken);
app.use('/api/v1', logRoutes);

describe('Log API Endpoints', () => {
  after(() => {
    sinon.restore();
  });

  beforeEach(async () => {
    await Log.deleteMany({ agent_id: 'agent_test' });
  });

  it('should queue a log (POST /logs)', (done) => {
    request(app)
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        agent_id: 'agent_test',
        step_id: 1,
        input_data: { test: 'data' },
        output: { result: 'ok' },
        reasoning: 'Test log creation with sufficient details',
      })
      .expect(202)
      .end(done);
  });

  it('should queue log review update (PUT /logs/:agent_id/:step_id)', (done) => {
    Log.create({
      agent_id: 'agent_test',
      step_id: 2,
      input_data: { test: 'data' },
      output: { result: 'error' },
      reasoning: 'error found',
      status: 'anomaly',
      trace_id: 'trace_123',
    })
      .then(() => {
        request(app)
          .put('/api/v1/logs/agent_test/2')
          .set('Authorization', `Bearer ${token}`)
          .send({
            reviewed: true,
            review_comments: 'Reviewed by auditor.',
          })
          .expect(202)
          .end(done);
      })
      .catch(done);
  });

  it('should search logs with filters (GET /logs/search)', (done) => {
    Log.create({
      agent_id: 'agent_test',
      step_id: 3,
      input_data: {},
      output: {},
      reasoning: 'valid reasoning for search test',
      status: 'anomaly',
    })
      .then(() => {
        request(app)
          .get('/api/v1/logs/search?agent_id=agent_test&status=anomaly')
          .set('Authorization', `Bearer ${token}`)
          .expect(200)
          .expect((res) => {
            if (!Array.isArray(res.body.data)) throw new Error('Data is not an array');
          })
          .end(done);
      })
      .catch(done);
  });

  it('should return a summary of logs (GET /logs/summary/:agent_id)', (done) => {
    Log.create({
      agent_id: 'agent_test',
      step_id: 4,
      input_data: {},
      output: {},
      reasoning: 'valid reasoning for summary test',
      status: 'success',
    })
      .then(() => {
        request(app)
          .get('/api/v1/logs/summary/agent_test')
          .set('Authorization', `Bearer ${token}`)
          .expect(200)
          .expect((res) => {
            const summary = res.body.data;
            if (!summary || summary._id !== 'agent_test' || typeof summary.count !== 'number') {
              throw new Error('Missing expected summary aggregate');
            }
          })
          .end(done);
      })
      .catch(done);
  });
});
