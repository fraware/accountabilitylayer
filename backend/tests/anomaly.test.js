const { detectAnomaly } = require('../src/services/logService');
const { expect } = require('chai');

describe('Anomaly Detection Logic', () => {
  it('should flag negative step_id as anomaly', () => {
    const logData = { step_id: -1, reasoning: 'Valid reasoning' };
    expect(detectAnomaly(logData)).to.be.true;
  });

  it('should flag short reasoning as anomaly', () => {
    const logData = { step_id: 1, reasoning: 'short' };
    expect(detectAnomaly(logData)).to.be.true;
  });

  it('should flag logs containing "error" in reasoning as anomaly', () => {
    const logData = { step_id: 1, reasoning: 'There was an Error during processing' };
    expect(detectAnomaly(logData)).to.be.true;
  });

  it('should not flag valid logs as anomaly', () => {
    const logData = { step_id: 1, reasoning: 'This is a valid log with sufficient details' };
    expect(detectAnomaly(logData)).to.be.false;
  });
});
