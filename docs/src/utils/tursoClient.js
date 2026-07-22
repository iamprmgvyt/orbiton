// ============================================================
// Orbiton Docs - Turso Cloud Edge SQLite Client
// Lightweight HTTP Pipeline client for Turso LibSQL Database
// ============================================================

const TURSO_URL = import.meta.env.VITE_TURSO_DB_URL || 'libsql://orbiton-docs-iamprmgvyt.aws-ap-northeast-1.turso.io';
const TURSO_TOKEN = import.meta.env.VITE_TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQ2OTQ2OTksImlkIjoiMDE5Zjg4MTYtOTMwMS03MTY2LTk4M2YtMmI4NDkyYzhkNjZjIiwia2lkIjoicGtZTlk2RHcxVV95VjZuVEw5N0Z5Q1lQTEEtUXhCU3BidlZpUEFpWWFFRSIsInJpZCI6Ijc1MGFlYzE2LTI1NWItNDY3Ny05YTUwLTE1NGExNDI2ODVhNCJ9.t8cAgHGR3OAu7WWvHJtwELrFjZwfE3OQULTfqeZrz1RirPFGb4hKf5P5D6IHlZGzB2D7eyG66D5QIIjvzxfMAA';

function getHttpsPipelineUrl(urlStr) {
  const clean = urlStr.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '');
  return `${clean}/v2/pipeline`;
}

/**
 * Execute SQL Query on Turso Cloud Edge Database via HTTP REST Pipeline
 * @param {string} sql SQL query string
 * @param {Array} args Positional parameters
 */
export async function executeTursoQuery(sql, args = []) {
  const pipelineUrl = getHttpsPipelineUrl(TURSO_URL);

  const formattedArgs = args.map(arg => {
    if (arg === null || arg === undefined) return { type: 'null' };
    if (typeof arg === 'number') {
      return Number.isInteger(arg) ? { type: 'integer', value: String(arg) } : { type: 'float', value: arg };
    }
    return { type: 'text', value: String(arg) };
  });

  const res = await fetch(pipelineUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          type: 'execute',
          stmt: {
            sql,
            args: formattedArgs
          }
        },
        { type: 'close' }
      ]
    })
  });

  if (!res.ok) {
    throw new Error(`Turso HTTP request failed with status ${res.status}`);
  }

  const json = await res.json();
  const execResult = json.results?.[0]?.response?.result;

  if (!execResult) {
    const errorMsg = json.results?.[0]?.response?.error?.message || 'Turso query execution failed';
    throw new Error(errorMsg);
  }

  const cols = (execResult.cols || []).map(c => c.name);
  const rows = (execResult.rows || []).map(row => {
    const obj = {};
    cols.forEach((colName, idx) => {
      const cell = row[idx];
      let val = cell?.value;
      if (cell?.type === 'integer') val = parseInt(val, 10);
      if (cell?.type === 'float') val = parseFloat(val);
      obj[colName] = val;
    });
    return obj;
  });

  return rows;
}
