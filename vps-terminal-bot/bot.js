// ============================================================
// Orbiton VPS Terminal Discord Bot (SSH Connection Mode)
// A secure Discord Bot to manage and run terminal commands on your VPS via SSH.
// Authorized User ID: 1262304052361035857
// SSH Server: 180.93.106.17 (ubuntu)
// ============================================================

require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const SSHClient = require('ssh2').Client;
const os = require('os');

const token = process.env.DISCORD_BOT_TOKEN;
const authorizedUserId = process.env.AUTHORIZED_USER_ID || '1262304052361035857';

// SSH Configuration
const sshConfig = {
  host: process.env.SSH_HOST || '180.93.106.17',
  port: parseInt(process.env.SSH_PORT || '22'),
  username: process.env.SSH_USER || 'ubuntu',
  password: process.env.SSH_PASS || 'ctG3T2UgLf5EaNcd'
};

if (!token) {
  console.error('❌ Error: DISCORD_BOT_TOKEN must be configured in .env!');
  process.exit(1);
}

// Helper to execute command over SSH connection
function executeSSH(command) {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        let stdout = '';
        let stderr = '';
        
        stream.on('close', (code, signal) => {
          conn.end();
          resolve({ stdout, stderr, code });
        }).on('data', (data) => {
          stdout += data.toString();
        }).stderr.on('data', (data) => {
          stderr += data.toString();
        });
      });
    }).on('error', (err) => {
      reject(err);
    }).connect(sshConfig);
  });
}

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`🪐 Orbiton VPS Terminal Discord Bot (SSH Mode) is active as ${client.user.tag}!`);
  console.log(`🔐 Authorization locked to Discord User ID: ${authorizedUserId}`);
  console.log(`🌐 Target Host: ${sshConfig.username}@${sshConfig.host}:${sshConfig.port}`);
  
  client.user.setActivity('VPS SSH Console', { type: ActivityType.Listening });
});

// Security Gatekeeper helper
function isAuthorized(message) {
  if (message.author.id !== authorizedUserId) {
    console.warn(`⚠️ Unauthorized command attempt from Discord User: ${message.author.tag} (ID: ${message.author.id})`);
    message.reply(`❌ **Access Denied!**\nYou are not authorized to run commands on this VPS.\nYour Discord ID (${message.author.id}) has been logged.`);
    return false;
  }
  return true;
}

client.on('messageCreate', async (message) => {
  // Ignore bots
  if (message.author.bot) return;

  const content = message.content.trim();

  // ─── Command: !help ──────────────────────────────────────────
  if (content === '!help' || content === '!start') {
    if (!isAuthorized(message)) return;

    const helpMsg = `
🪐 **Orbiton VPS Terminal Discord Bot (SSH Connection Mode)**
Secure command execution active for user ID: \`${authorizedUserId}\`.

**Available Shortcuts:**
📊 \`!stats\` - View system statistics (CPU, RAM, Disk, Uptime) via SSH
⚡ \`!run <command>\` - Run any shell command on VPS via SSH
🔄 \`!reboot\` - Reboot the VPS server via SSH
    `;
    message.reply(helpMsg);
  }

  // ─── Command: !stats ──────────────────────────────────────────
  else if (content === '!stats') {
    if (!isAuthorized(message)) return;

    const statusMsg = await message.reply('📊 Connecting to VPS and gathering system metrics, please wait...');

    try {
      // Execute metrics commands over SSH
      const { stdout } = await executeSSH('free -m && df -h / && uptime');
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

      const statsText = `
📊 **VPS System Status (SSH Mode):**
🌐 **Target Host:** \`${sshConfig.username}@${sshConfig.host}\`
🔋 **RAM Usage:** \`${ramUsage}\`
💾 **Disk Usage:** \`${diskUsage}\`
⏱️ **System Uptime:** \`${uptimeLine.trim()}\`
      `;

      statusMsg.edit(statsText);
    } catch (err) {
      statusMsg.edit(`❌ SSH Error retrieving stats: \`${err.message}\``);
    }
  }

  // ─── Command: !run <command> ──────────────────────────────────
  else if (content.startsWith('!run ')) {
    if (!isAuthorized(message)) return;

    const command = content.substring(5).trim();
    if (!command) return message.reply('❌ Please specify a command. Example: `!run df -h`');

    const statusMsg = await message.reply(`⚡ Executing SSH command: \`${command}\`...`);

    try {
      const { stdout, stderr, code } = await executeSSH(command);
      let response = '';

      if (code !== 0) {
        response += `❌ **Command failed with exit code:** \`${code}\`\n\n`;
      }

      const output = (stdout || '') + (stderr || '');
      if (!output.trim()) {
        response += `⚠️ **Command finished with empty output.**`;
      } else {
        // Truncate output to prevent exceeding Discord's 2000 character limit
        let codeBlock = output;
        if (codeBlock.length > 1850) {
          codeBlock = '...[Log output truncated due to length]\n\n' + codeBlock.substring(codeBlock.length - 1700);
        }
        response += `\`\`\`bash\n${codeBlock}\n\`\`\``;
      }

      statusMsg.edit(response).catch(() => {
        message.reply('❌ Output payload was too large for Discord to display. Please refine your command parameters.');
      });
    } catch (err) {
      statusMsg.edit(`❌ SSH Execution Error: \`${err.message}\``);
    }
  }

  // ─── Command: !reboot ─────────────────────────────────────────
  else if (content === '!reboot') {
    if (!isAuthorized(message)) return;

    message.reply('⚠️ Confirm VPS reboot by typing: `!confirm_reboot`');
  }

  else if (content === '!confirm_reboot') {
    if (!isAuthorized(message)) return;

    await message.reply('🔄 Initiating SSH system reboot now... Connection will close.');

    try {
      // Execute reboot with password via stdin/sudo reboot -S if needed, or passwordless
      await executeSSH('echo "ctG3T2UgLf5EaNcd" | sudo -S reboot');
    } catch (err) {
      message.reply(`❌ Reboot failed: \`${err.message}\``);
    }
  }
});

// Login Discord Client
client.login(token);
