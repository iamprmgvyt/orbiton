<div align="center">

# 🌐 Orbiton

**Universal App & Server Manager**

Lightweight, self-hosted panel to manage any application — Node.js, Python, Java, Docker, Go, Rust, and more. 

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20macOS-blue.svg)]()
[![Installs](https://img.shields.io/badge/dynamic/json?color=blueviolet&label=Installs&query=count&url=https%3A%2F%2Fapi.counterapi.dev%2Fv1%2Forbiton%2Finstall)](https://github.com/iamprmgvyt/orbiton)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🚀 **App Manager** | Create, start, stop, restart, and kill any process. |
| ⌨️ **Unified Interactive Console** | xterm.js terminal console that fetches history logs and connects to live process streams (Pterodactyl-style). |
| 📥 **Sequential Startup Flow** | Automatically executes the **Install Command** (e.g. `npm install`, `pip install`) *before* launching the startup command. |
| 🛡️ **Node Firewall Port Manager** | Manage (open & close) VPS ports directly from the Admin Settings panel using UFW. |
| 🔌 **Cloudflare SSL Support** | Instantly configures Flexible SSL options to avoid `ERR_TOO_MANY_REDIRECTS` loop. |
| 🔧 **Runtime Detection** | Telemetry scanning to detect Node.js, Python, Java, Docker, and other installed runtimes. |
| 👥 **Multi-user Support** | Admin + User roles backed by JWT authorization. |
| 🖥️ **Lightweight** | Embedded SQLite database and Node.js. Extremely resource-friendly (uses < 50MB RAM). |

## 🚀 Supported Runtimes

```
🟩 Node.js    🐍 Python    ☕ Java (8/11/17/21/22+)    🐳 Docker
🔵 Go         🦀 Rust      🦕 Deno    🥟 Bun
🐘 PHP        💎 Ruby      🔧 Bash/Shell    ⚙️ Any custom command
```

---

## 📦 Installation & Setup

### Method 1: Interactive Auto-Installer (Recommended for VPS Ubuntu)

Run the interactive bash installer on your VPS to automatically configure Node.js, SQLite, UFW Firewall, and register systemd services.

```bash
git clone https://github.com/iamprmgvyt/orbiton.git
cd orbiton
sudo bash install.sh
```

---

### Method 2: Manual Development Setup

#### 1. Configure and run Daemon (Wings Agent)
```bash
cd daemon
npm install
# Copy configurations and adjust ports/token
cp .env.example .env
node server.js
```
*Note: Daemon runs on port `9900` by default.*

#### 2. Configure and run Web Panel
```bash
cd panel
npm install
# Copy configurations and update DAEMON_URL & DAEMON_TOKEN
cp .env.example .env
node server.js
```
*Note: Panel runs on port `3000` (HTTP) / `3443` (HTTPS) by default.*

---

## 🔐 Credentials & Ports

| Component | Default Port | Default Login |
|-----------|--------------|---------------|
| **Web Panel** | `3000` (HTTP) / `3443` (HTTPS) | Set up your own custom administrator account on first web access! |
| **Daemon Node** | `9900` (HTTP) | Secure Token: check `.env` (`DAEMON_TOKEN`) |

---

## 📁 Project Structure

```
orbiton/
├── panel/
│   ├── server.js               # Web Panel entry point
│   ├── db/database.js          # SQLite database wrapper
│   ├── dist/                   # Compiled static frontend files
│   └── routes/                 # Express API routes
├── daemon/
│   ├── server.js               # Daemon Agent entry point (Wings-style)
│   └── managers/
│       └── processManager.js   # Process orchestration layer
├── frontend/
│   ├── src/                    # React SPA Frontend codebase
│   └── vite.config.js          # Vite config
├── install.sh                  # Interactive Ubuntu auto-installer
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| Backend | Node.js + Express | Fast, asynchronous |
| Database | SQLite (better-sqlite3) | Zero config, single file |
| Console | xterm.js + socket.io | Pterodactyl-style live interactive streaming |
| Frontend | React (Vite) | Modern, fast and modular |
| Firewall | UFW CLI | Direct system integration |

---

## 📄 License

MIT — free for personal and commercial use.

---

<div align="center">

**Orbiton** — Manage everything, from anywhere.

Made with ❤️

</div>
