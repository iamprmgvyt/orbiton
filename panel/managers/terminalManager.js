// ============================================================
// Orbiton Panel - Terminal Manager (Socket.IO Tunnel Client)
// Proxy socket.io commands between client and daemon node.
// ============================================================
const { io } = require('socket.io-client');
const { DAEMON_URL, DAEMON_TOKEN } = require('../utils/daemonApi');

function setupSocketHandlers(ioServer) {
  ioServer.on('connection', (socket) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) { socket.disconnect(true); return; }

    let user;
    try {
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../middleware/auth');
      user = jwt.verify(token, JWT_SECRET);
    } catch { socket.disconnect(true); return; }

    socket.user = user;
    let daemonSocket = null;

    // Client request to spin up pty
    socket.on('terminal:create', ({ appId, cols, rows } = {}) => {
      // Connect to Daemon node
      daemonSocket = io(DAEMON_URL, {
        auth: { token: DAEMON_TOKEN },
        reconnection: false
      });

      daemonSocket.on('connect', () => {
        daemonSocket.emit('terminal:create', { appId, cols, rows });
        socket.emit('terminal:ready', { termId: appId ? `app_${appId}` : 'sys_host' });
      });

      daemonSocket.on('terminal:data', ({ data }) => {
        socket.emit('terminal:data', { data });
      });

      daemonSocket.on('connect_error', (err) => {
        socket.emit('terminal:data', { data: `\r\n\x1b[31m[Orbiton Proxy Error] Could not connect to daemon node: ${err.message}\x1b[0m\r\n` });
      });

      daemonSocket.on('disconnect', () => {
        socket.emit('terminal:data', { data: '\r\n\x1b[31m[Orbiton Proxy] Connection to daemon node closed.\x1b[0m\r\n' });
      });
    });

    // Client sends input
    socket.on('terminal:input', ({ input }) => {
      if (daemonSocket && daemonSocket.connected) {
        daemonSocket.emit('terminal:input', { input });
      }
    });

    // Client resizes
    socket.on('terminal:resize', ({ cols, rows }) => {
      if (daemonSocket && daemonSocket.connected) {
        daemonSocket.emit('terminal:resize', { cols, rows });
      }
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      if (daemonSocket) {
        daemonSocket.disconnect();
        daemonSocket = null;
      }
    });
  });
}

module.exports = { setupSocketHandlers };
