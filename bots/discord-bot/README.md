# 🤖 Orbiton Discord Bot

A lightweight, open-source Discord bot to monitor and control your Orbiton Panel servers remotely.

## Features
- `/status` — Lists all hosted apps and states in a beautiful glowing embed.
- `/control <app-id> <action>` — Remotely start, stop, restart, or force-kill processes.
- `/stats` — Check host system resource utilization (CPU, RAM, OS, Uptime).

## Setup & Deployment

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Copy `.env.example` to `.env` and fill in your bot token, guild server ID, and Orbiton Panel API configurations:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   GUILD_ID=your_discord_guild_id_here
   PANEL_URL=http://localhost:3000
   PANEL_USERNAME=admin
   PANEL_PASSWORD=your_admin_password_here
   ```

3. **Start the Bot:**
   ```bash
   npm start
   ```

---
*Created by iamprmgvyt*
