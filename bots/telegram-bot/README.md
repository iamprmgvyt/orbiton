# 🤖 Orbiton Telegram Bot

A lightweight, open-source Python Telegram bot to monitor and control your Orbiton Panel servers remotely.

## Features
- `/status` — Check all hosted apps and states in the chat.
- `/control <app-id> <action>` — Remotely start, stop, restart, or force-kill processes.
- `/vps` — Display VPS server resource utilization (CPU, RAM, OS, Uptime).

## Setup & Deployment

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure Environment:**
   Copy `.env.example` to `.env` and fill in your telegram bot token and Orbiton Panel API configurations:
   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   PANEL_URL=http://localhost:3000
   PANEL_USERNAME=admin
   PANEL_PASSWORD=your_admin_password_here
   ```

3. **Start the Bot:**
   ```bash
   python bot.py
   ```

---
*Created by iamprmgvyt*
