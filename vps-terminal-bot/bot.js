// ============================================================
// Orbiton VPS Terminal Bot
// A secure Telegram Bot to manage and run terminal commands on your VPS.
// Built for user: ubuntu
// ============================================================

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');
const os = require('os');

const token = process.env.TELEGRAM_BOT_TOKEN;
const authorizedUserId = parseInt(process.env.AUTHORIZED_USER_ID);
const vpsUser = process.env.VPS_USER || 'ubuntu';

if (!token || isNaN(authorizedUserId)) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN and AUTHORIZED_USER_ID must be configured in .env!');
  process.exit(1);
}

// Initialize Telegram Bot in Polling Mode
const bot = new TelegramBot(token, { polling: true });

console.log(`🪐 Orbiton VPS Terminal Bot is active!`);
console.log(`🔐 Authorization locked to Telegram User ID: ${authorizedUserId}`);
console.log(`👤 Running commands as system user: ${vpsUser}`);

// Security Gatekeeper middleware
function isAuthorized(msg) {
  const userId = msg.from.id;
  if (userId !== authorizedUserId) {
    console.warn(`⚠️ Unauthorized access attempt from Telegram User: ${msg.from.username || 'N/A'} (ID: ${userId})`);
    bot.sendMessage(msg.chat.id, `❌ *Access Denied!*\nYou are not authorized to control this VPS.\nYour ID (${userId}) has been logged.`, { parse_mode: 'Markdown' });
    return false;
  }
  return true;
}

// ─── Command: /start ──────────────────────────────────────────
bot.onText(/^\/start$/, (msg) => {
  if (!isAuthorized(msg)) return;

  const welcomeMessage = `
🪐 *Orbiton VPS Terminal Bot*
Secure command execution active for user *${vpsUser}*.

*Available Shortcuts:*
ℹ️ /stats - View system statistics (CPU, RAM, Disk)
🔧 /run \`<command>\` - Run any shell command on VPS
🔄 /reboot - Reboot the VPS server (requires sudo)
  `;

  bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: 'Markdown' });
});

// ─── Command: /stats ──────────────────────────────────────────
bot.onText(/^\/stats$/, (msg) => {
  if (!isAuthorized(msg)) return;

  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '📊 Gathering VPS stats, please wait...');

  exec('free -m && df -h / && uptime', (err, stdout, stderr) => {
    if (err) {
      return bot.sendMessage(chatId, `❌ Error retrieving stats: \`${err.message}\``, { parse_mode: 'Markdown' });
    }

    const lines = stdout.split('\n');
    
    // Parse RAM info
    const ramLine = lines.find(l => l.startsWith('Mem:'));
    let ramUsage = 'N/A';
    if (ramLine) {
      const parts = ramLine.split(/\s+/);
      const total = parseInt(parts[1]);
      const used = parseInt(parts[2]);
      ramUsage = `${used}MB / ${total}MB (${Math.round((used / total) * 100)}%)`;
    }

    // Parse Disk info
    const diskLine = lines.find(l => l.includes(' /') && !l.includes('shm'));
    let diskUsage = 'N/A';
    if (diskLine) {
      const parts = diskLine.trim().split(/\s+/);
      diskUsage = `${parts[2]} / ${parts[1]} (${parts[4]} used)`;
    }

    // System uptime
    const uptimeLine = lines[lines.length - 2] || 'N/A';

    const statsMsg = `
📊 *VPS System Status:*
👤 *System User:* \`${vpsUser}\`
🖥️ *Hostname:* \`${os.hostname()}\`
🔋 *OS Platform:* \`${os.type()} ${os.release()}\`
🧠 *CPU Cores:* \`${os.cpus().length} cores\`
💡 *RAM Usage:* \`${ramUsage}\`
💾 *Disk Usage:* \`${diskUsage}\`
⏱️ *System Uptime:* \`${uptimeLine.trim()}\`
    `;

    bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
  });
});

// ─── Command: /run <command> ──────────────────────────────────
bot.onText(/^\/run (.+)$/, (msg, match) => {
  if (!isAuthorized(msg)) return;

  const chatId = msg.chat.id;
  const command = match[1];

  bot.sendMessage(chatId, `⚡ Executing: \`${command}\`...`, { parse_mode: 'Markdown' });

  // Execute shell command
  exec(command, { maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
    let response = '';

    if (err) {
      response += `❌ *Command failed with exit code:* \`${err.code || 1}\`\n\n`;
    }

    const output = (stdout || '') + (stderr || '');
    if (!output.trim()) {
      response += `⚠️ *Command finished with empty output.*`;
    } else {
      // Truncate output to prevent exceeding Telegram's 4096 character limit
      let codeBlock = output;
      if (codeBlock.length > 3900) {
        codeBlock = codeBlock.substring(0, 3900) + '\n\n...[Log output truncated due to length]';
      }
      response += `\`\`\`bash\n${codeBlock}\n\`\`\``;
    }

    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  });
});

// ─── Command: /reboot ─────────────────────────────────────────
bot.onText(/^\/reboot$/, (msg) => {
  if (!isAuthorized(msg)) return;

  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '⚠️ Confirm VPS reboot by typing: `/confirm_reboot`', { parse_mode: 'Markdown' });
});

bot.onText(/^\/confirm_reboot$/, (msg) => {
  if (!isAuthorized(msg)) return;

  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🔄 Initiating system reboot now... Connection will close.', { parse_mode: 'Markdown' });

  exec('sudo reboot', (err) => {
    if (err) {
      bot.sendMessage(chatId, `❌ Reboot failed: \`${err.message}\` (Check if sudo passwordless reboot is enabled for ${vpsUser})`, { parse_mode: 'Markdown' });
    }
  });
});
