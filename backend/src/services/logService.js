exports.detectAnomaly = (logData) => {
    // Basic checks.
    if (logData.step_id < 0) return true;
    if (!logData.reasoning || logData.reasoning.length < 10) return true;
    
    // Advanced rule: if reasoning contains the word "error", flag as anomaly.
    if (logData.reasoning.toLowerCase().includes('error')) return true;
    
    // Additional heuristics (e.g., frequency checks, historical comparisons) can be integrated here.
    
    return false;
  };
  
  // Simulate notification integration when an anomaly is detected.
  exports.notifyAnomaly = (logEntry) => {
    // In a real system, integrate with an email/Slack API.
    console.log(`[NOTIFICATION] Anomaly detected for agent ${logEntry.agent_id}, step ${logEntry.step_id}.`);
    
    // Optionally, record this notification event as part of the audit trail.
  };
  