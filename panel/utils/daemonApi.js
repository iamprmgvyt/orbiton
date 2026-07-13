const DAEMON_URL = process.env.DAEMON_URL || 'http://localhost:9900';
const DAEMON_TOKEN = process.env.DAEMON_TOKEN || 'orbiton_daemon_secret_token_123';

async function daemonRequest(endpoint, method = 'GET', body = null) {
  const url = `${DAEMON_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DAEMON_TOKEN}`
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
