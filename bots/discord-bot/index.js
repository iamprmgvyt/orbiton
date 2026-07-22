// ============================================================
// Orbiton Discord Bot - Command Orchestration
// Remotely control and monitor Orbiton processes via Discord.
// ============================================================
require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  EmbedBuilder,
  ActivityType
} = require('discord.js');
const axios = require('axios');

const {
  DISCORD_TOKEN,
  GUILD_ID,
  PANEL_URL,
  PANEL_USERNAME,
  PANEL_PASSWORD
} = process.env;

if (!DISCORD_TOKEN || !PANEL_URL || !PANEL_USERNAME || !PANEL_PASSWORD) {
  console.error('❌ Missing environment configurations in .env file!');
  process.exit(1);
}

// Client setup
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let jwtToken = '';

// Helper to authenticate with Orbiton Panel
async function authenticateWithPanel() {
  try {
    const res = await axios.post(`${PANEL_URL}/api/auth/login`, {
      username: PANEL_USERNAME,
      password: PANEL_PASSWORD
    });
    jwtToken = res.data.token;
    console.log('🔑 Authenticated successfully with Orbiton Panel API.');
  } catch (err) {
    console.error('❌ Failed to authenticate with Panel API:', err.response?.data?.error || err.message);
  }
}

// Helper to query Panel API with auto-reauth
async function apiRequest(endpoint, method = 'GET', data = null) {
  if (!jwtToken) await authenticateWithPanel();
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
      await authenticateWithPanel();
      // Retry request
      const retryRes = await axios({
        url: `${PANEL_URL}${endpoint}`,
        method,
        data,
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      return retryRes.data;
    }
    throw err;
  }
}

// Commands schema definition
const commands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Lists all hosted applications on Orbiton Panel and their active status.'),
  
  new SlashCommandBuilder()
    .setName('control')
    .setDescription('Send execution power commands to a hosted application.')
    .addStringOption(option =>
      option.setName('app-id')
        .setDescription('The ID of the target application')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Action to execute')
        .setRequired(true)
        .addChoices(
          { name: 'Start', value: 'start' },
          { name: 'Stop', value: 'stop' },
          { name: 'Restart', value: 'restart' },
          { name: 'Kill', value: 'kill' }
        )),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Display resources utilization of the VPS host node.'),

  new SlashCommandBuilder()
    .setName('nodes')
    .setDescription('Display status of all registered worker nodes in the cluster.'),

  new SlashCommandBuilder()
    .setName('branding')
    .setDescription('View current panel customization and public configurations.')
].map(command => command.toJSON());

// Deploy slash commands
async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    const clientId = client.user.id;
    console.log('🔄 Deploying application (/) commands...');
    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(clientId, GUILD_ID),
        { body: commands }
      );
      console.log('✅ Guild-level commands deployed successfully.');
    } else {
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log('✅ Global commands deployed successfully.');
    }
  } catch (err) {
    console.error('❌ Failed to register slash commands:', err);
  }
}

client.once('ready', async () => {
  console.log(`🤖 Logged in as Discord Bot: ${client.user.tag}`);
  try {
    const publicSettings = await axios.get(`${PANEL_URL}/api/auth/settings/public`);
    const pName = publicSettings.data?.panel_name || 'Orbiton';
    client.user.setActivity(pName, { type: ActivityType.Watching });
  } catch (_) {
    client.user.setActivity('Orbiton Panel', { type: ActivityType.Watching });
  }
  await authenticateWithPanel();
  await registerSlashCommands();
});

// Interactions router
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  await interaction.deferReply();

  try {
    if (commandName === 'status') {
      const apps = await apiRequest('/api/apps');
      const embed = new EmbedBuilder()
        .setTitle('🪐 Orbiton Apps Status')
        .setColor('#8b5cf6')
        .setDescription('Current running state of application instances:')
        .setTimestamp()
        .setFooter({ text: '🤖 Orbiton Controller Bot | Created by iamprmgvyt' });

      if (apps.length === 0) {
        embed.addFields({ name: 'No Applications', value: 'There are no apps hosted on this panel.' });
      } else {
        apps.forEach(app => {
          const statusEmoji = app.status === 'running' || app.liveStatus === 'running' ? '🟢 Running' : '🔴 Stopped';
          embed.addFields({
            name: `${app.name} (\`${app.id.substring(0, 8)}...\`)`,
            value: `• **Status:** ${statusEmoji}\n• **Runtime:** \`${app.runtime}\`\n• **Owner:** \`${app.owner_name}\``,
            inline: false
          });
        });
      }

      await interaction.editReply({ embeds: [embed] });
    }

    else if (commandName === 'control') {
      const appId = interaction.options.getString('app-id');
      const action = interaction.options.getString('action');

      await apiRequest(`/api/apps/${appId}/${action}`, 'POST');

      const embed = new EmbedBuilder()
        .setTitle('⚡ Process Action Dispatched')
        .setColor('#10b981')
        .setDescription(`Successfully sent **${action.toUpperCase()}** command to application **${appId}**.`)
        .setTimestamp()
        .setFooter({ text: '🤖 Orbiton Controller Bot | Created by iamprmgvyt' });

      await interaction.editReply({ embeds: [embed] });
    }

    else if (commandName === 'stats') {
      const stats = await apiRequest('/api/system/stats');
      const embed = new EmbedBuilder()
        .setTitle('📊 Host system resource utilization')
        .setColor('#3b82f6')
        .addFields(
          { name: '🖥️ CPU Usage', value: `\`${stats.cpu.usage}%\` (${stats.cpu.cores} Cores)`, inline: true },
          { name: '💾 Memory', value: `\`${stats.memory.usedPercent}%\` (${Math.round(stats.memory.used / 1024 / 1024)}MB / ${Math.round(stats.memory.total / 1024 / 1024)}MB)`, inline: true },
          { name: '💿 OS Info', value: `\`${stats.os.distro}\` (${stats.os.arch})`, inline: false },
          { name: '⏱️ Uptime', value: `\`${Math.round(stats.os.uptime / 3600)} Hours\``, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: '🤖 Orbiton Controller Bot | Created by iamprmgvyt' });

      await interaction.editReply({ embeds: [embed] });
    }

    else if (commandName === 'nodes') {
      const nodes = await apiRequest('/api/nodes');
      const embed = new EmbedBuilder()
        .setTitle('🌐 Registered Cluster Nodes')
        .setColor('#10b981')
        .setTimestamp()
        .setFooter({ text: '🤖 Orbiton Controller Bot | Created by iamprmgvyt' });

      if (!nodes || nodes.length === 0) {
        embed.setDescription('No worker nodes registered.');
      } else {
        nodes.forEach(n => {
          embed.addFields({
            name: `📍 Node: ${n.name} (ID: ${n.id})`,
            value: `• **FQDN:** \`${n.fqdn}:${n.port}\`\n• **Status:** ${n.status === 'online' ? '🟢 Online' : '🔴 Offline'}\n• **Is Master:** \`${n.is_master ? 'Yes' : 'No'}\``
          });
        });
      }

      await interaction.editReply({ embeds: [embed] });
    }

    else if (commandName === 'branding') {
      const publicSettings = await axios.get(`${PANEL_URL}/api/auth/settings/public`);
      const embed = new EmbedBuilder()
        .setTitle('🏷️ Panel Branding Configuration')
        .setColor('#f59e0b')
        .addFields(
          { name: 'Panel Brand Name', value: `\`${publicSettings.data?.panel_name || 'Orbiton'}\``, inline: true },
          { name: 'Panel URL', value: `\`${PANEL_URL}\``, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: '🤖 Orbiton Controller Bot | Created by iamprmgvyt' });

      await interaction.editReply({ embeds: [embed] });
    }
  } catch (err) {
    console.error(`Error executing command ${commandName}:`, err.message);
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Command Execution Failed')
      .setColor('#ef4444')
      .setDescription(err.response?.data?.error || err.message)
      .setFooter({ text: '🤖 Orbiton Controller Bot | Created by iamprmgvyt' });
    await interaction.editReply({ embeds: [errorEmbed] });
  }
});

client.login(DISCORD_TOKEN);
