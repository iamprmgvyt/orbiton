// ============================================================
// Orbiton Microservices - Daemon Service
// Handles REST API networking and authentication protocols between Node agent instances.
// ============================================================

const axios = require('axios');
const { db } = require('../db/database');

class DaemonService {
  /**
   * Send HTTP request to a target worker daemon node
   * @param {string} path Target API path
   * @param {string} method HTTP Method (GET, POST, PATCH, DELETE)
   * @param {object} data JSON Request payload
   * @param {number} nodeId Target Node ID
   */
  static async request(path, method = 'GET', data = null, nodeId = 1) {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
    
    let url, token;
    if (node) {
      url = `http://${node.ip}:${node.port}${path}`;
      token = node.token;
    } else {
      // Fallback AIO localhost node
      const fallbackUrl = process.env.DAEMON_URL || 'http://localhost:9900';
      url = `${fallbackUrl}${path}`;
      token = process.env.DAEMON_TOKEN;
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const response = await axios({
      method,
      url,
      data,
      headers,
      timeout: 15000 // 15s timeout
    });

    return response.data;
  }
}

module.exports = DaemonService;
