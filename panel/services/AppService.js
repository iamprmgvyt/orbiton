// ============================================================
// Orbiton Microservices - Application Service
// Orchestrates application business logic, DB queries, and coordinates with Daemon Nodes.
// ============================================================

const { db } = require('../db/database');
const DaemonService = require('./DaemonService');

class AppService {
  /**
   * Fetch list of applications based on user privileges
   */
  static getAppsList(userId, role) {
    if (role === 'admin') {
      return db.prepare(`
        SELECT a.*, u.username AS owner_name
        FROM apps a JOIN users u ON a.owner_id = u.id
        ORDER BY a.created_at DESC
      `).all();
    }
    
    return db.prepare(`
      SELECT a.*, u.username AS owner_name
      FROM apps a JOIN users u ON a.owner_id = u.id
      WHERE a.owner_id = ? OR a.id IN (SELECT app_id FROM permissions WHERE user_id = ?)
      ORDER BY a.created_at DESC
    `).all(userId, userId);
  }

  /**
   * Fetch single application data
   */
  static getAppById(appId) {
    return db.prepare('SELECT * FROM apps WHERE id = ?').get(appId);
  }

  /**
   * Fetch live application process state from daemon
   */
  static async getLiveStatus(appId, nodeId) {
    return DaemonService.request(`/api/apps/${appId}/status`, 'GET', null, nodeId)
      .catch(() => ({ status: 'stopped', pid: null }));
  }

  /**
   * Send power action command to Daemon node
   */
  static async sendPowerAction(appId, action, appConfig = null, nodeId = 1) {
    const payload = appConfig ? { appConfig } : null;
    return DaemonService.request(`/api/apps/${appId}/${action}`, 'POST', payload, nodeId);
  }

  /**
   * Execute backup command on target node
   */
  static async executeBackup(appId, nodeId) {
    return DaemonService.request(`/api/backups/${appId}/create`, 'POST', null, nodeId);
  }

  /**
   * Send console stdin commands to Daemon pty process
   */
  static async sendStdin(appId, input, nodeId) {
    return DaemonService.request(`/api/apps/${appId}/input`, 'POST', { input }, nodeId);
  }
}

module.exports = AppService;
