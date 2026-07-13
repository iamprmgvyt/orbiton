const { db } = require('../db/database');

const DAEMON_URL = process.env.DAEMON_URL || 'http://localhost:9900';
const DAEMON_TOKEN = process.env.DAEMON_TOKEN || 'orbiton_daemon_secret_token_123';

async function daemonRequest(endpoint, method = 'GET', body = null, nodeId = 1) {
  let targetUrl = DAEMON_URL;
  let targetToken = DAEMON_TOKEN;

  if (nodeId) {
    try {
      const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
      if (node) {
        const host = node.ip.replace(/\/$/, '');
        targetUrl = `http://${host}:${node.port}`;
        targetToken = node.token;
      }
    } catch (_) {}
  }

  const url = `${targetUrl}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${targetToken}`
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Daemon request failed');
  }
  return data;
}

module.exports = { daemonRequest, DAEMON_URL, DAEMON_TOKEN };
