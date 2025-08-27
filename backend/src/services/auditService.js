const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

class AuditService {
  constructor() {
    this.merkleRoots = new Map(); // Store Merkle roots by time window
    this.auditChain = []; // Chain of audit events
    this.currentWindow = this.getCurrentTimeWindow();
    this.windowSize = 3600000; // 1 hour in milliseconds
  }

  // Generate SHA-256 hash for data
  generateHash(data) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  // Generate Merkle tree from array of hashes
  generateMerkleTree(hashes) {
    if (hashes.length === 0) return null;
    if (hashes.length === 1) return hashes[0];

    const tree = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = i + 1 < hashes.length ? hashes[i + 1] : left;
      const combined = left + right;
      tree.push(this.generateHash(combined));
    }

    return this.generateMerkleTree(tree);
  }

  // Get current time window (hourly)
  getCurrentTimeWindow() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
  }

  // Add log entry to audit chain
  async addLogEntry(logData) {
    const timestamp = new Date().toISOString();
    const logId = logData._id || uuidv4();
    
    // Generate hash for the log entry
    const logHash = this.generateHash({
      id: logId,
      agent_id: logData.agent_id,
      step_id: logData.step_id,
      trace_id: logData.trace_id,
      user_id: logData.user_id,
      input_data: logData.input_data,
      output: logData.output,
      reasoning: logData.reasoning,
      status: logData.status,
      timestamp: logData.timestamp,
      version: logData.version || 1
    });

    // Create audit entry
    const auditEntry = {
      id: uuidv4(),
      type: 'LOG_CREATED',
      logId: logId,
      logHash: logHash,
      timestamp: timestamp,
      metadata: {
        agent_id: logData.agent_id,
        user_id: logData.user_id,
        ip: logData.metadata?.ip,
        userAgent: logData.metadata?.userAgent
      },
      previousHash: this.auditChain.length > 0 ? this.auditChain[this.auditChain.length - 1].hash : null
    };

    // Generate hash for the audit entry
    auditEntry.hash = this.generateHash(auditEntry);

    // Add to audit chain
    this.auditChain.push(auditEntry);

    // Update Merkle root for current time window
    await this.updateMerkleRoot(logHash);

    return {
      logHash,
      auditEntry,
      merkleRoot: this.merkleRoots.get(this.currentWindow)
    };
  }

  // Update log entry in audit chain
  async updateLogEntry(logId, updates, userId, metadata = {}) {
    const timestamp = new Date().toISOString();
    
    // Create audit entry for update
    const auditEntry = {
      id: uuidv4(),
      type: 'LOG_UPDATED',
      logId: logId,
      updates: updates,
      timestamp: timestamp,
      metadata: {
        user_id: userId,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        reason: metadata.reason
      },
      previousHash: this.auditChain.length > 0 ? this.auditChain[this.auditChain.length - 1].hash : null
    };

    // Generate hash for the audit entry
    auditEntry.hash = this.generateHash(auditEntry);

    // Add to audit chain
    this.auditChain.push(auditEntry);

    return auditEntry;
  }

  // Update Merkle root for current time window
  async updateMerkleRoot(logHash) {
    const currentWindow = this.getCurrentTimeWindow();
    
    if (currentWindow !== this.currentWindow) {
      // New time window, finalize previous window
      await this.finalizeTimeWindow(this.currentWindow);
      this.currentWindow = currentWindow;
    }

    // Get or create hash list for current window
    if (!this.merkleRoots.has(currentWindow)) {
      this.merkleRoots.set(currentWindow, {
        windowStart: currentWindow,
        windowEnd: currentWindow + this.windowSize,
        hashes: [],
        merkleRoot: null,
        finalized: false
      });
    }

    const windowData = this.merkleRoots.get(currentWindow);
    windowData.hashes.push(logHash);

    // Update Merkle root
    windowData.merkleRoot = this.generateMerkleTree(windowData.hashes);
  }

  // Finalize time window and generate proof
  async finalizeTimeWindow(windowStart) {
    const windowData = this.merkleRoots.get(windowStart);
    if (!windowData || windowData.finalized) return;

    windowData.finalized = true;
    windowData.finalizedAt = new Date().toISOString();

    // Create window finalization audit entry
    const auditEntry = {
      id: uuidv4(),
      type: 'WINDOW_FINALIZED',
      windowStart: windowStart,
      windowEnd: windowStart + this.windowSize,
      merkleRoot: windowData.merkleRoot,
      hashCount: windowData.hashes.length,
      timestamp: new Date().toISOString(),
      previousHash: this.auditChain.length > 0 ? this.auditChain[this.auditChain.length - 1].hash : null
    };

    auditEntry.hash = this.generateHash(auditEntry);
    this.auditChain.push(auditEntry);

    console.log(`Time window finalized: ${new Date(windowStart).toISOString()} - ${new Date(windowStart + this.windowSize).toISOString()}, Root: ${windowData.merkleRoot}`);
  }

  // Generate Merkle proof for a specific log entry
  generateMerkleProof(logHash, timeWindow) {
    const windowData = this.merkleRoots.get(timeWindow);
    if (!windowData || !windowData.hashes.includes(logHash)) {
      throw new Error('Log hash not found in specified time window');
    }

    const proof = {
      logHash: logHash,
      timeWindow: timeWindow,
      merkleRoot: windowData.merkleRoot,
      siblings: [],
      path: []
    };

    // Generate proof path
    let currentIndex = windowData.hashes.indexOf(logHash);
    let currentHashes = [...windowData.hashes];

    while (currentHashes.length > 1) {
      if (currentIndex % 2 === 0) {
        // Left node, include right sibling
        if (currentIndex + 1 < currentHashes.length) {
          proof.siblings.push(currentHashes[currentIndex + 1]);
          proof.path.push('L');
        }
      } else {
        // Right node, include left sibling
        proof.siblings.push(currentHashes[currentIndex - 1]);
        proof.path.push('R');
      }

      // Move to parent level
      currentIndex = Math.floor(currentIndex / 2);
      currentHashes = this.generateMerkleTreeLevel(currentHashes);
    }

    return proof;
  }

  // Generate Merkle tree level
  generateMerkleTreeLevel(hashes) {
    const level = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = i + 1 < hashes.length ? hashes[i + 1] : left;
      const combined = left + right;
      level.push(this.generateHash(combined));
    }
    return level;
  }

  // Verify Merkle proof
  verifyMerkleProof(proof) {
    let currentHash = proof.logHash;

    for (let i = 0; i < proof.siblings.length; i++) {
      const sibling = proof.siblings[i];
      const direction = proof.path[i];

      if (direction === 'L') {
        // Left node, combine with right sibling
        currentHash = this.generateHash(currentHash + sibling);
      } else {
        // Right node, combine with left sibling
        currentHash = this.generateHash(sibling + currentHash);
      }
    }

    return currentHash === proof.merkleRoot;
  }

  // Generate audit pack for export
  async generateAuditPack(startTime, endTime, options = {}) {
    const auditPack = {
      id: uuidv4(),
      generatedAt: new Date().toISOString(),
      timeRange: { start: startTime, end: endTime },
      metadata: options.metadata || {},
      merkleRoots: [],
      auditChain: [],
      verification: {}
    };

    // Collect Merkle roots for the time range
    for (const [windowStart, windowData] of this.merkleRoots.entries()) {
      if (windowStart >= startTime && windowStart < endTime) {
        auditPack.merkleRoots.push({
          windowStart: windowStart,
          windowEnd: windowStart + this.windowSize,
          merkleRoot: windowData.merkleRoot,
          hashCount: windowData.hashes.length,
          finalized: windowData.finalized
        });
      }
    }

    // Collect audit chain entries for the time range
    auditPack.auditChain = this.auditChain.filter(entry => {
      const entryTime = new Date(entry.timestamp).getTime();
      return entryTime >= startTime && entryTime < endTime;
    });

    // Generate verification data
    auditPack.verification = {
      totalEntries: auditPack.auditChain.length,
      merkleRootsCount: auditPack.merkleRoots.length,
      chainIntegrity: this.verifyAuditChainIntegrity(auditPack.auditChain),
      packHash: this.generateHash(JSON.stringify(auditPack))
    };

    return auditPack;
  }

  // Verify audit chain integrity
  verifyAuditChainIntegrity(auditChain) {
    if (auditChain.length === 0) return true;

    for (let i = 1; i < auditChain.length; i++) {
      const current = auditChain[i];
      const previous = auditChain[i - 1];

      if (current.previousHash !== previous.hash) {
        return false;
      }

      // Verify current entry hash
      const expectedHash = this.generateHash({
        id: current.id,
        type: current.type,
        logId: current.logId,
        logHash: current.logHash,
        updates: current.updates,
        timestamp: current.timestamp,
        metadata: current.metadata,
        previousHash: current.previousHash
      });

      if (expectedHash !== current.hash) {
        return false;
      }
    }

    return true;
  }

  // Get audit statistics
  getStats() {
    const currentWindow = this.getCurrentTimeWindow();
    const totalWindows = this.merkleRoots.size;
    const totalAuditEntries = this.auditChain.length;

    return {
      currentWindow: new Date(currentWindow).toISOString(),
      totalWindows: totalWindows,
      totalAuditEntries: totalAuditEntries,
      merkleRoots: Array.from(this.merkleRoots.values()).map(w => ({
        windowStart: new Date(w.windowStart).toISOString(),
        hashCount: w.hashes.length,
        finalized: w.finalized,
        merkleRoot: w.merkleRoot
      }))
    };
  }

  // Export audit data to file
  async exportAuditData(filePath, startTime, endTime) {
    const auditPack = await this.generateAuditPack(startTime, endTime);
    await fs.writeFile(filePath, JSON.stringify(auditPack, null, 2));
    return auditPack;
  }

  // Import and verify audit data
  async importAuditData(filePath) {
    const data = await fs.readFile(filePath, 'utf8');
    const auditPack = JSON.parse(data);

    // Verify the audit pack
    const verification = {
      packHash: this.generateHash(JSON.stringify(auditPack)),
      chainIntegrity: this.verifyAuditChainIntegrity(auditPack.auditChain),
      merkleRootsValid: true
    };

    // Verify Merkle roots
    for (const merkleRoot of auditPack.merkleRoots) {
      if (!merkleRoot.merkleRoot || !merkleRoot.hashCount) {
        verification.merkleRootsValid = false;
        break;
      }
    }

    return {
      auditPack,
      verification,
      isValid: verification.chainIntegrity && verification.merkleRootsValid
    };
  }
}

module.exports = AuditService;
