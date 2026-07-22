const BASE_URL = '/api';

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function removeToken() {
  localStorage.removeItem('token');
}

export function getUser() {
  const user = localStorage.getItem('user');
  try {
    return user ? JSON.parse(user) : null;
  } catch (_) {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

export async function api(endpoint, method = 'GET', body = null) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);

  if (response.status === 429) {
    console.warn('API returned 429. Retrying automatically in 1s...');
    await new Promise(r => setTimeout(r, 1000));
    const retryRes = await fetch(`${BASE_URL}${endpoint}`, options);
    if (retryRes.ok) return await retryRes.json();
    return Array.isArray(body) ? [] : {};
  }

  if (response.status === 401) {
    removeToken();
    localStorage.removeItem('user');
    window.location.reload();
    throw new Error('Unauthorized');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export function createThrottledAction(actionFn, bufferMs = 800) {
  let lastCall = 0;
  return async (...args) => {
    const now = Date.now();
    if (now - lastCall < bufferMs) {
      console.warn('Action throttled: please wait before clicking again.');
      return;
    }
    lastCall = now;
    return await actionFn(...args);
  };
}

export function fmtBytes(bytes) {
  if (bytes === 0 || !bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function fmtDate(d) {
  if (!d) return 'N/A';
  try {
    const isoStr = String(d).replace(' ', 'T');
    const date = new Date(isoStr);
    return isNaN(date.getTime()) ? String(d) : date.toLocaleString();
  } catch (_) {
    return String(d);
  }
}
