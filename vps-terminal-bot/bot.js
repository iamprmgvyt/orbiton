// ============================================================
// Orbiton VPS Terminal Discord Bot
// A secure Discord Bot to manage and run terminal commands on your VPS as root.
// Authorized User ID: 1262304052361035857
// ============================================================

require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { exec } = require('child_process');
const os = require('os');

const token = process.env.DISCORD_BOT_TOKEN;
const authorizedUserId = process.env.AUTHORIZED_USER_ID || '1262304052361035857';
const runAsRoot = process.env.RUN_AS_ROOT === 'true';

if (!token) {
  console.error('❌ Error: DISCORD_BOT_TOKEN must be configured in .env!');
  process.exit(1);
}

// Initialize Discord Client with Gateway Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`🪐 Orbiton VPS Terminal Discord Bot is active as ${client.user.tag}!`);
  console.log(`🔐 Authorization locked to Discord User ID: ${authorizedUserId}`);
  console.log(`👑 Root execution mode: ${runAsRoot ? 'ENABLED (sudo)' : 'DISABLED'}`);
  
  client.user.setActivity('VPS Shell Console', { type: ActivityType.Listening });
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
🪐 **Orbiton VPS Terminal Discord Bot**
Secure command execution active for user ID: \`${authorizedUserId}\`.

**Available Shortcuts:**
📊 \`!stats\` - View system statistics (CPU, RAM, Disk, Uptime)
⚡ \`!run <command>\` - Run any shell command on VPS
🔄 \`!reboot\` - Reboot the VPS server
    `;
    message.reply(helpMsg);
  }

  // ─── Command: !stats ──────────────────────────────────────────
  else if (content === '!stats') {
    if (!isAuthorized(message)) return;

    const statusMsg = await message.reply('📊 Gathering VPS system metrics, please wait...');

    exec('free -m && df -h / && uptime', (err, stdout, stderr) => {
      if (err) {
        return statusMsg.edit(`❌ Error retrieving stats: \`${err.message}\``);
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

      const statsText = `
📊 **VPS System Status:**
👑 **Execution Mode:** \`${runAsRoot ? 'root (sudo)' : 'standard'}\`
🖥️ **Hostname:** \`${os.hostname()}\`
🔋 **OS Platform:** \`${os.type()} ${os.release()}\`
🧠 **CPU Cores:** \`${os.cpus().length} cores\`
💡 **RAM Usage:** \`${ramUsage}\`
💾 **Disk Usage:** \`${diskUsage}\`
⏱️ **System Uptime:** \`${uptimeLine.trim()}\`
      `;

      statusMsg.edit(statsText);
    });
  }

  // ─── Command: !run <command> ──────────────────────────────────
  else if (content.startsWith('!run ')) {
    if (!isAuthorized(message)) return;

    const rawCommand = content.substring(5).trim();
    if (!rawCommand) return message.reply('❌ Please specify a command. Example: `!run df -h`');

    // If configured to run as root, prefix with sudo (unless already sudoed)
    const command = (runAsRoot && !rawCommand.startsWith('sudo')) ? `sudo ${rawCommand}` : rawCommand;

    const statusMsg = await message.reply(`⚡ Executing command: \`${command}\`...`);

    // Execute command with a large buffer (5MB)
    exec(command, { maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
      let response = '';

      if (err) {
        response += `❌ **Command failed with exit code:** \`${err.code || 1}\`\n\n`;
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
        // Fallback in case message payload still exceeds limit
        message.reply('❌ Output payload was too large for Discord to display. Please refine your command parameters.');
      });
    });
  }

  // ─── Command: !reboot ─────────────────────────────────────────
  else if (content === '!reboot') {
    if (!isAuthorized(message)) return;

    message.reply('⚠️ Confirm VPS reboot by typing: `!confirm_reboot`');
  }

  else if (content === '!confirm_reboot') {
    if (!isAuthorized(message)) return;

    await message.reply('🔄 Initiating system reboot now... Connection will close.');

    exec('sudo reboot', (err) => {
      if (err) {
        message.reply(`❌ Reboot failed: \`${err.message}\` (Check if sudo passwordless reboot is enabled for the bot user)`);
      }
    });
  }
});

// Login Discord Client
client.login(token);
