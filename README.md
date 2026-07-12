<div align="center">

# 🌐 Orbiton

**Universal App & Server Manager**

Lightweight, self-hosted panel to manage any application — Node.js, Python, Java, Docker, Go, Rust, and more.

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)]()
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](Dockerfile)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🚀 **App Manager** | Create, start, stop, restart, kill any process |
| ⌨️ **AIO Terminal** | Real shell (bash/zsh/PowerShell) — run any language |
| 📥 **Import** | From **Git**, **ZIP**, **Docker Image**, or **Templates** |
| 📋 **Live Logs** | WebSocket streaming, stdin input |
| 📁 **File Manager** | Browse, edit, upload, download files |
| 📈 **System Monitor** | CPU/RAM charts, top processes |
| 🔧 **Runtime Checker** | Detect 20+ installed tools |
| 🔒 **HTTPS/SSL** | Auto-detect certs, supports Let's Encrypt |
| 👥 **Multi-user** | Admin + user roles with JWT auth |
| 🐳 **Docker Ready** | Run Orbiton itself in Docker |
| 🖥️ **Cross-platform** | Windows, macOS, Linux |

## 🚀 Supported Runtimes

```
🟩 Node.js    🐍 Python    ☕ Java (8/11/17/21/22+)    🐳 Docker
🔵 Go         🦀 Rust      🦕 Deno    🥟 Bun
🐘 PHP        💎 Ruby      🔧 Bash/Shell    ⚙️ Any custom command
```

---

## 📦 Installation & Setup

### Method 1: Interactive Auto-Installer (Recommended for VPS Ubuntu 22/24 LTS)

```bash
git clone https://github.com/iamprmgvyt/orbiton.git
cd orbiton
sudo bash install.sh
```
This interactive script allows you to choose to install **both Panel & Daemon** on the same machine, **Panel only**, or **Daemon only**. It handles dependencies (Node.js, Docker, Java, Python), firewall rules, and registers systemd services automatically.

---

### Method 2: Manual Setup & GitHub Codespaces (For local development/testing)

> [!NOTE]
> Codespaces will only auto-forward ports if you start the server processes **directly in your terminal** instead of running background systemd services.

Follow these steps in separate terminals:

#### 1. Start the Node Agent (Daemon)
```bash
cd orbiton/daemon
npm install
node server.js
```
*Daemon runs on port `8080` by default.*

#### 2. Start the Central Web Panel
```bash
cd orbiton/panel
npm install
node server.js
```
*Panel runs on port `3000` by default. Codespaces will automatically popup a notification to forward ports `3000` and `8080`. Click to open port `3000` in browser.*

---

## 🔐 Credentials & Ports

| Component | Default Port | Default Login |
|-----------|--------------|---------------|
| **Web Panel** | `3000` (HTTP) / `3443` (HTTPS) | Username: `admin` <br> Password: `admin123` |
| **Daemon Node** | `8080` (HTTP) | Secure Token: check `.env` (`DAEMON_TOKEN`) |

> [!IMPORTANT]
> Change the default password immediately in settings after logging in!


---

## 📥 Import Applications

Orbiton supports multiple ways to import your project:

### From Git Repository
```
App Manager → + New App → Git Clone tab
→ Enter GitHub/GitLab URL → Create
```

### From ZIP File
```
App Manager → + New App → ZIP Upload tab
→ Drag & drop your .zip → Create
```

### From Docker Image
```
App Manager → + New App → Docker tab
→ Enter image name (e.g. nginx:latest) → Create
```

### From Template
Pre-built presets for popular frameworks:
- 🤖 Discord.js / Discord.py Bot
- 🌐 Express.js / FastAPI API
- ⛏️ Minecraft Server
- 🌿 Spring Boot
- 🐳 Docker Compose
- ✈️ Telegram Bot
- ▲ Next.js
- 📄 Static File Server

---

## ⌨️ AIO Terminal

The terminal is a **real shell** — runs bash on Linux/macOS, PowerShell on Windows.

```bash
# Node.js
node index.js
npm install discord.js

# Python
python3 bot.py
pip3 install requests

# Java (any version)
java -jar app.jar
java --version

# Docker
docker run nginx
docker compose up -d

# Any command
git clone https://github.com/user/repo
wget https://example.com/file.zip
./run.sh
```

---

## 🔒 HTTPS / SSL

**Self-signed (instant):**
```bash
bash generate-cert.sh
```

**Let's Encrypt (with domain):**
```bash
certbot certonly --standalone -d panel.yourdomain.com
ln -sf /etc/letsencrypt/live/panel.yourdomain.com/fullchain.pem certs/fullchain.pem
ln -sf /etc/letsencrypt/live/panel.yourdomain.com/privkey.pem   certs/privkey.pem
# Restart Orbiton
```

Orbiton **auto-detects** the `certs/` directory and switches to HTTPS automatically.

---

## 🖥️ Cross-Platform

| Platform | Terminal Shell | Data Directory |
|----------|---------------|----------------|
| Linux    | bash / zsh    | `/opt/orbiton-data` |
| macOS    | zsh / bash    | `~/orbiton-data` |
| Windows  | PowerShell / cmd | `%APPDATA%\orbiton-data` |

---

## 📁 Project Structure

```
orbiton/
├── backend/
│   ├── server.js               # HTTP + HTTPS entry point
│   ├── package.json
│   ├── db/database.js          # SQLite (zero-config)
│   ├── managers/
│   │   ├── processManager.js   # Cross-platform process control
│   │   └── terminalManager.js  # node-pty PTY terminal
│   ├── middleware/auth.js      # JWT middleware
│   └── routes/
│       ├── auth.js             # Login, users
│       ├── apps.js             # App CRUD + import
│       ├── files.js            # File manager
│       └── system.js           # Stats, runtimes
├── frontend/
│   ├── index.html              # Login page
│   ├── dashboard.html          # Main UI
│   ├── css/style.css           # Dark glassmorphism theme
│   └── js/app.js               # All UI logic
├── certs/                      # SSL certs (auto-detected)
├── Dockerfile                  # Docker image
├── docker-compose.yml          # Docker Compose
├── install.sh                  # Ubuntu 24 auto-install
├── generate-cert.sh            # Self-signed SSL
├── .gitignore
└── README.md
```

---

## ⚙️ Configuration

Copy `.env.example` to `.env` in the `backend/` folder:

```env
PORT=3000
SSL_PORT=3443
JWT_SECRET=your-random-secret-here   # openssl rand -hex 32
NODE_ENV=production
DATA_DIR=/opt/orbiton-data            # optional
```

---

## 🛠️ Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| Backend | Node.js + Express | Fast, lightweight |
| Database | SQLite (better-sqlite3) | Zero config, file-based |
| Terminal | node-pty + xterm.js | Real PTY shell |
| Realtime | Socket.IO | WebSocket live logs |
| Frontend | Vanilla HTML/CSS/JS | No build step needed |
| Auth | JWT + bcrypt | Secure, stateless |
| Import | Git CLI + unzipper | Flexible project import |

---

## 🐳 Deploy with Docker

```bash
# Build & run
docker compose up -d

# View logs
docker compose logs -f

# Update
git pull && docker compose up -d --build
```

### Environment via Docker:
```bash
docker run -d \
  -p 3000:3000 -p 3443:3443 \
  -v orbiton-data:/data \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  --name orbiton \
  ghcr.io/iamprmgvyt/orbiton:latest
```

---

## 📊 System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 256 MB | 512 MB+ |
| Disk | 500 MB | 2 GB+ |
| Node.js | 18+ | 22 LTS |
| OS | Any | Ubuntu 24 / Debian 12 |

---

## 📄 License

MIT — free for personal and commercial use.

---

<div align="center">

**Orbiton** — Manage everything, from anywhere.

Made with ❤️

</div>
