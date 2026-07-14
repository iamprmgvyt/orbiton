# 🤖 Orbiton Discord Bot

A lightweight, open-source Discord bot to monitor and control your Orbiton Panel servers remotely. This directory contains both Node.js (JavaScript) and Python implementations.

## Features
- `/status` — Lists all hosted apps and states in a beautiful glowing embed.
- `/control <app-id> <action>` — Remotely start, stop, restart, or force-kill processes.
- `/stats` — Check host system resource utilization (CPU, RAM, OS, Uptime).

---

## 🟢 Option 1: Node.js (JavaScript) Version

### Setup & Run
1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Configure Environment:**
   Copy `.env.example` to `.env` and fill in your configurations.
3. **Start the Bot:**
   ```bash
   npm start
   ```

---

## 🟢 Option 2: Python Version

### Setup & Run
1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Configure Environment:**
   Copy `.env.example` to `.env` and fill in your configurations (uses same variables as Node.js).
3. **Start the Bot:**
   ```bash
   python bot.py
   ```

---
*Created by iamprmgvyt*
