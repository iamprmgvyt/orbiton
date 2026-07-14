# 🤖 Orbiton Telegram Bot

A lightweight, open-source Telegram bot to monitor and control your Orbiton Panel servers remotely. This directory contains both Python and Node.js (JavaScript) implementations.

## Features
- `/status` — Check all hosted apps and states in the chat.
- `/control <app-id> <action>` — Remotely start, stop, restart, or force-kill processes.
- `/vps` or `/stats` — Display VPS server resource utilization (CPU, RAM, OS, Uptime).

---

## 🟢 Option 1: Python Version

### Setup & Run
1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Configure Environment:**
   Copy `.env.example` to `.env` and fill in your configurations.
3. **Start the Bot:**
   ```bash
   python bot.py
   ```

---

## 🟢 Option 2: Node.js (JavaScript) Version

### Setup & Run
1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Configure Environment:**
   Copy `.env.example` to `.env` and fill in your configurations (uses same variables as Python).
3. **Start the Bot:**
   ```bash
   npm start
   ```

---
*Created by iamprmgvyt*
