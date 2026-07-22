const { io } = require('socket.io-client');
const { db } = require('../db/database');
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
      // ── Permission Verification Guard ────────────────────────
      if (socket.user.role !== 'admin') {
        if (!appId) {
          // Host system terminal requested by non-admin -> Deny & Disconnect
          socket.emit('terminal:data', { data: '\r\n\x1b[31m[Orbiton Security Error] Access Denied: Only administrators can access host system terminals.\x1b[0m\r\n' });
          socket.disconnect(true);
          return;
        }

        try {
          const app = db.prepare('SELECT owner_id FROM apps WHERE id = ?').get(appId);
          if (!app) {
            socket.emit('terminal:data', { data: '\r\n\x1b[31m[Orbiton Security Error] Access Denied: Application not found.\x1b[0m\r\n' });
            socket.disconnect(true);
            return;
          }

          if (app.owner_id !== socket.user.id) {
            const perm = db.prepare('SELECT can_console FROM permissions WHERE user_id = ? AND app_id = ?').get(socket.user.id, appId);
            if (!perm || perm.can_console !== 1) {
              socket.emit('terminal:data', { data: '\r\n\x1b[31m[Orbiton Security Error] Access Denied: You lack interactive console privileges for this application.\x1b[0m\r\n' });
              socket.disconnect(true);
              return;
            }
          }
        } catch (err) {
          socket.emit('terminal:data', { data: `\r\n\x1b[31m[Orbiton Security Error] Permission check failed: ${err.message}\x1b[0m\r\n` });
          socket.disconnect(true);
          return;
        }
      }

      let targetUrl = DAEMON_URL;
      let targetToken = DAEMON_TOKEN;

      if (appId) {
        try {
          const app = db.prepare('SELECT node_id FROM apps WHERE id = ?').get(appId);
          if (app && app.node_id) {
            const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(app.node_id);
            if (node) {
              targetUrl = `http://${node.ip.replace(/\/$/, '')}:${node.port}`;
              targetToken = node.token;
            }
          }
        } catch (_) {}
      }

      // Connect to Daemon node
      daemonSocket = io(targetUrl, {
        auth: { token: targetToken },
        reconnection: false,
        transports: ['websocket']
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

    // Client subscribes to real-time system metrics
    socket.on('metrics:subscribe', ({ nodeId }) => {
      socket.join(`metrics:${nodeId}`);
    });

    socket.on('metrics:unsubscribe', ({ nodeId }) => {
      socket.leave(`metrics:${nodeId}`);
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      if (daemonSocket) {
        daemonSocket.disconnect();
        daemonSocket = null;
      }
    });
  });

  // Start metrics broadcasting interval
  startMetricsBroadcaster(ioServer);
}

function startMetricsBroadcaster(ioServer) {
  const { daemonRequest } = require('../utils/daemonApi');
  
  setInterval(async () => {
    try {
      const nodes = db.prepare('SELECT id FROM nodes').all();
      for (const node of nodes) {
        const roomName = `metrics:${node.id}`;
        const clientsInRoom = ioServer.sockets.adapter.rooms.get(roomName);
        if (clientsInRoom && clientsInRoom.size > 0) {
          try {
            const stats = await daemonRequest('/api/system/stats', 'GET', null, node.id);
            ioServer.to(roomName).emit('metrics:data', { nodeId: node.id, stats });
          } catch (err) {
            ioServer.to(roomName).emit('metrics:error', { nodeId: node.id, error: err.message });
          }
        }
      }
    } catch (_) {}
  }, 3000); // Poll and broadcast every 3 seconds
}

module.exports = { setupSocketHandlers };
