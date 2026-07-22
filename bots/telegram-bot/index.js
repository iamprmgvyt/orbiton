// ============================================================
// Orbiton Telegram Bot - Node.js Version
# Remotely control and monitor Orbiton processes via Telegram.
// ============================================================
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const {
  TELEGRAM_BOT_TOKEN,
  PANEL_URL,
  PANEL_USERNAME,
  PANEL_PASSWORD
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !PANEL_URL || !PANEL_USERNAME || !PANEL_PASSWORD) {
  console.error('❌ Missing configs in .env file!');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
let jwtToken = '';

// Helper to authenticate with Orbiton Panel API
async function authenticate() {
  try {
    const res = await axios.post(`${PANEL_URL}/api/auth/login`, {
      username: PANEL_USERNAME,
      password: PANEL_PASSWORD
    });
    jwtToken = res.data.token;
    console.log('🔑 Authenticated successfully with Orbiton Panel.');
    return true;
  } catch (err) {
    console.error('❌ Authentication failed:', err.response?.data?.error || err.message);
    return false;
  }
}

// Safe API Request wrapper with auto-reauth
async function apiRequest(endpoint, method = 'GET', data = null) {
  if (!jwtToken) await authenticate();
  try {
    const res = await axios({
      url: `${PANEL_URL}${endpoint}`,
      method,
      data,
      headers: { Authorization: `Bearer ${jwtToken}` }
    });
    return res.data;
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      console.log('🔄 Token expired, re-authenticating...');
      const success = await authenticate();
      if (success) {
        const retryRes = await axios({
          url: `${PANEL_URL}${endpoint}`,
          method,
          data,
          headers: { Authorization: `Bearer ${jwtToken}` }
        });
        return retryRes.data;
      }
    }
    throw err;
  }
}

console.log('🤖 Telegram Bot is starting polling...');
authenticate();

// Commands routing
bot.onText(/\/start|\/help/, async (msg) => {
  let panelName = 'Orbiton';
  try {
    const publicSettings = await axios.get(`${PANEL_URL}/api/auth/settings/public`);
    panelName = publicSettings.data?.panel_name || 'Orbiton';
  } catch (_) {}

  const helpText = 
    `🪐 *Welcome to ${panelName} Controller Bot!* (Node.js)\n\n` +
    `Available commands:\n` +
    `• \`/status\` — List all hosted applications and states\n` +
    `• \`/control <app-id> <action>\` — Control app (\`start\`, \`stop\`, \`restart\`, \`kill\`)\n` +
    `• \`/vps\` — Display VPS server resource utilization\n` +
    `• \`/nodes\` — Display status of registered cluster nodes\n` +
    `• \`/branding\` — Display panel brand customization\n\n` +
    `🤖 _${panelName} Controller Bot | Created by iamprmgvyt_`;
  bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

// /status handler
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const apps = await apiRequest('/api/apps');
    if (!apps || apps.length === 0) {
      bot.sendMessage(chatId, `🪐 *Apps Status*\nNo applications hosted on this panel.\n\n🤖 _Orbiton Controller Bot | Created by iamprmgvyt_`, { parse_mode: 'Markdown' });
      return;
    }

    let text = `🪐 *Apps Status*\n\n`;
    apps.forEach(app => {
      const statusEmoji = app.status === 'running' || app.liveStatus === 'running' ? '🟢 Running' : '🔴 Stopped';
      text += `• *${app.name}* (\`${app.id.substring(0, 8)}...\`)\n`;
      text += `  Status: ${statusEmoji} | Runtime: \`${app.runtime}\`\n\n`;
    });

    text += `🤖 _Orbiton Controller Bot | Created by iamprmgvyt_`;
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Failed to fetch apps status: ${err.message}`);
  }
});

// /control handler
bot.onText(/\/control(?:\s+(\S+))?(?:\s+(\S+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const appId = match[1];
  const action = match[2] ? match[2].toLowerCase() : null;

  if (!appId || !action) {
    bot.sendMessage(chatId, `⚠ Usage: \`/control <app-id> <start|stop|restart|kill>\``, { parse_mode: 'Markdown' });
    return;
  }

  if (!['start', 'stop', 'restart', 'kill'].includes(action)) {
    bot.sendMessage(chatId, `❌ Invalid action! Select: start, stop, restart, or kill.`);
    return;
  }

  try {
    await apiRequest(`/api/apps/${appId}/${action}`, 'POST');
    const responseText = 
      `⚡ *Action Dispatched*\n` +
      `Successfully sent *${action.toUpperCase()}* command to application \`${appId}\`.\n\n` +
      `🤖 _Orbiton Controller Bot | Created by iamprmgvyt_`;
    bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Execution failed: ${err.message}`);
  }
});

// /vps handler
bot.onText(/\/vps/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const stats = await apiRequest('/api/system/stats');
    const cpuUsage = stats.cpu.usage;
    const cpuCores = stats.cpu.cores;
    const memPct = stats.memory.usedPercent;
    const memUsed = Math.round(stats.memory.used / 1024 / 1024);
    const memTotal = Math.round(stats.memory.total / 1024 / 1024);
    const distro = stats.os.distro;
    const arch = stats.os.arch;
    const uptime = Math.round(stats.os.uptime / 3600);

    const statsText = 
      `📊 *Host VPS Resource Utilization*\n\n` +
      `• *CPU Usage:* \`${cpuUsage}%\` (${cpuCores} Cores)\n` +
      `• *Memory:* \`${memPct}%\` (${memUsed}MB / ${memTotal}MB)\n` +
      `• *OS:* \`${distro}\` (${arch})\n` +
      `• *Uptime:* \`${uptime} Hours\`\n\n` +
      `🤖 _Orbiton Controller Bot | Created by iamprmgvyt_`;
    bot.sendMessage(chatId, statsText, { parse_mode: 'Markdown' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Failed to fetch VPS stats: ${err.message}`);
  }
});

// /nodes handler
bot.onText(/\/nodes/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const nodes = await apiRequest('/api/nodes');
    if (!nodes || nodes.length === 0) {
      bot.sendMessage(chatId, `🌐 *Cluster Nodes*\nNo worker nodes registered.\n\n🤖 _Orbiton Controller Bot_`, { parse_mode: 'Markdown' });
      return;
    }
    let text = `🌐 *Registered Cluster Nodes*\n\n`;
    nodes.forEach(n => {
      text += `• *Node:* ${n.name} (ID: ${n.id})\n`;
      text += `  FQDN: \`${n.fqdn}:${n.port}\` | Status: ${n.status === 'online' ? '🟢 Online' : '🔴 Offline'}\n\n`;
    });
    text += `🤖 _Orbiton Controller Bot_`;
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Failed to fetch nodes: ${err.message}`);
  }
});

// /branding handler
bot.onText(/\/branding/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const publicSettings = await axios.get(`${PANEL_URL}/api/auth/settings/public`);
    const pName = publicSettings.data?.panel_name || 'Orbiton';
    const text = 
      `🏷️ *Panel Branding Configuration*\n\n` +
      `• *Panel Brand Name:* \`${pName}\`\n` +
      `• *Panel URL:* \`${PANEL_URL}\`\n\n` +
      `🤖 _Orbiton Controller Bot_`;
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Failed to fetch branding: ${err.message}`);
  }
});
