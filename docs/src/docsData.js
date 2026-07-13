export const DOCS_SECTIONS = [
  {
    id: 'intro',
    category: 'Getting Started',
    title: 'Introduction to Orbiton',
    content: `
# Introduction to Orbiton

Orbiton is a next-generation, lightweight, and open-source server management panel designed to host applications, game servers, Discord bots, and API backends. Built as a sleek and modern alternative to heavy panels like Pterodactyl, Orbiton focuses on visual beauty, real-time performance, and a low memory footprint.

---

### Core Highlights
* **Central Master Panel:** A unified dashboard to manage users, nodes, and deploy presets.
* **Isolated Node Daemons (Wings):** Nodes are fully decoupled, running on an asynchronous, event-driven Node.js runtime.
* **Realtime PTY Stream:** Full terminal logs stream instantly through TTY without output buffer delays.
* **Global Runtime Shop:** Seamlessly install, detect, or uninstall compiler environments (Node, Python, Java, Go, Rust...) directly via the Web UI.

### Quick Start Installation (Bash)
Clone the entire repository onto your VPS host and run the interactive bash installer:
\`\`\`bash
git clone https://github.com/iamprmgvyt/orbiton.git
cd orbiton
sudo bash install.sh
\`\`\`
* Running the script will present the official interactive installation menu:
  * **Option [0]:** Install both Panel and Daemon (All-in-One on the same machine) — ideal for single VPS setup.
  * **Option [1]:** Install Panel only (Central UI & User Database) — deploy this on your main control server.
  * **Option [2]:** Install Daemon only (Wings Agent on Node VPS) — deploy this on external worker nodes.
  * **Option [3]:** Configure Let's Encrypt SSL certificate — automatically generate and assign SSL to secure panel domain.
  * **Option [4]:** Uninstall Panel & Daemon — completely purge all folders, databases, and systemd services.
  * **Option [5]:** Cancel / Exit — cancel the installation.
    `
  },
  {
    id: 'architecture',
    category: 'Getting Started',
    title: 'System Architecture',
    content: `
# Multi-Node Architecture

Orbiton operates on a Master-Slave cluster model. This decouples the visual panel (Web UI and database) from the physical host servers running the user's software.

---

### Components
1. **Orbiton Panel (Master Node):**
   * Written in Express.js + React.
   * Manages user accounts, permissions, nodes directory, and stores config meta in SQLite.
   * Acts as a secure HTTP & Socket.IO proxy connecting client browsers to the appropriate nodes.
2. **Orbiton Daemon / Wings (Worker Node):**
   * Runs directly on client host servers.
   * Manages process isolation, auto-restart triggers, and dependency setup.
   * Spawns system PTY processes using \`node-pty\` for true interactive shell consoles.

### Communication Flow
\`\`\`mermaid
[ Browser ] <--- Socket.IO ---> [ Orbiton Panel ] <--- Proxy Client ---> [ Orbiton Daemon ]
                                                      (via Node Token Auth)
\`\`\`
    `
  },
  {
    id: 'install-panel',
    category: 'Installation',
    title: 'Deploying the Panel',
    content: `
# Deploying the Master Panel

The Orbiton Panel runs on any VPS running Ubuntu 20.04 LTS or newer. It acts as the central control room.

---

### System Requirements
* Ubuntu 20.04+ (Debian-based recommended).
* Node.js v18.x or newer.
* Ports \`3000\` (HTTP) and \`3443\` (HTTPS - optional) open in your firewall.

### Quick Bash Installation
Clone the entire repository onto your VPS host and run the interactive bash installer:
\`\`\`bash
git clone https://github.com/iamprmgvyt/orbiton.git
cd orbiton
sudo bash install.sh
\`\`\`
*Select option **1** to install the **Orbiton Panel** only (or option **0** for All-in-One panel + daemon setup).*

### Manual Setup
If you prefer setting up manually:
\`\`\`bash
# 1. Clone repository
git clone https://github.com/iamprmgvyt/orbiton.git
cd orbiton/panel

# 2. Install dependencies
npm install

# 3. Create .env file
echo "PORT=3000" > .env
echo "JWT_SECRET=generate_your_jwt_secret_key" >> .env
echo "DAEMON_URL=http://localhost:9900" >> .env
echo "DAEMON_TOKEN=your_master_daemon_token" >> .env

# 4. Build frontend
cd ../frontend
npm install
npm run build

# 5. Start Panel
cd ../panel
npm start
\`\`\`
    `
  },
  {
    id: 'install-daemon',
    category: 'Installation',
    title: 'Setting up Daemon Nodes',
    content: `
# Setting up Daemon Nodes

The Daemon (also called Wings) runs on every server where applications will be hosted. It listens for commands from the Panel.

---

### Prerequisites
* Port \`9900\` open in your firewall to allow Panel connection.
* Node.js v18+ and compiler runtimes installed on the node.

### SSH Auto Setup (Recommended)
1. Go to the **Nodes** section in your Admin Panel.
2. Click **Add Node** and enter the Node IP and Port. Save it.
3. Click **Setup Configuration** on the newly created Node card.
4. Copy the **SSH Auto Setup Command** block and paste it directly into your Node VPS terminal.

### Manual Node Installation
\`\`\`bash
# 1. Create directory
sudo mkdir -p /opt/orbiton-daemon
cd /opt/orbiton-daemon

# 2. Clone daemon files
git clone https://github.com/iamprmgvyt/orbiton.git temp
mv temp/daemon/* ./
rm -rf temp

# 3. Install packages
npm install

# 4. Create config.json
cat <<EOF > config.json
{
  "PORT": 9900,
  "DAEMON_TOKEN": "your_secure_node_master_key",
  "DATA_DIR": "/opt/orbiton-data"
}
EOF

# 5. Start Daemon
node server.js
\`\`\`
    `
  },
  {
    id: 'api-telemetry',
    category: 'API Reference',
    title: 'GET /api/system/stats',
    content: `
# Query Host System Telemetry

Retrieve CPU usage, RAM utilization, Disk space, and Host OS details from a Daemon node.

---

### HTTP Request
* **Method:** \`GET\`
* **Endpoint:** \`/api/system/stats\`
* **Headers:** \`Authorization: Bearer <DAEMON_TOKEN>\`

### JSON Response Example
\`\`\`json
{
  "cpu": {
    "usage": 24,
    "model": "Intel(R) Xeon(R) Gold 6140 CPU @ 2.30GHz",
    "cores": 2,
    "load": [0.45, 0.32, 0.15]
  },
  "memory": {
    "total": 4182941696,
    "used": 1948293120,
    "usedPercent": 46
  },
  "os": {
    "distro": "Linux",
    "release": "6.8.0-134-generic",
    "hostname": "vps-node-1",
    "arch": "x64",
    "uptime": 86400
  },
  "disk": [
    {
      "usedPercent": 15,
      "used": 16106127360,
      "size": 107374182400
    }
  ]
}
\`\`\`
    `
  },
  {
    id: 'api-create',
    category: 'API Reference',
    title: 'POST /api/apps',
    content: `
# Deploy New Application Server

Register and spawn an isolated application process on a specific Daemon node.

---

### HTTP Request
* **Method:** \`POST\`
* **Endpoint:** \`/api/apps\`
* **Headers:** \`Authorization: Bearer <PANEL_TOKEN>\`

### Request Body (JSON)
\`\`\`json
{
  "name": "Production Node API",
  "runtime": "nodejs",
  "start_cmd": "node index.js",
  "install_cmd": "npm install",
  "max_ram": 1024,
  "auto_restart": 1,
  "node_id": 1,
  "env_vars": {
    "PORT": "8080",
    "DB_URI": "mongodb://localhost:27017/prod"
  }
}
\`\`\`

### JSON Response Example
\`\`\`json
{
  "id": "782f9d6c-67ba-4bcf-a192-d61081a293cc",
  "name": "Production Node API",
  "runtime": "nodejs",
  "start_cmd": "node index.js",
  "install_cmd": "npm install",
  "work_dir": "/opt/orbiton-data/apps/782f9d6c-67ba-4bcf-a192-d61081a293cc",
  "status": "stopped",
  "max_ram": 1024,
  "auto_restart": 1,
  "node_id": 1,
  "created_at": "2026-07-13 13:00:00"
}
\`\`\`
    `
  },
  {
    id: 'api-control',
    category: 'API Reference',
    title: 'POST /api/apps/:id/:action',
    content: `
# Control Server Power State

Execute power state actions on an application process.

---

### HTTP Request
* **Method:** \`POST\`
* **Endpoint:** \`/api/apps/:id/:action\`
* **Params:**
  * \`id\`: The UUID of the application.
  * \`action\`: Can be \`start\`, \`stop\`, \`restart\`, or \`kill\`.
* **Headers:** \`Authorization: Bearer <PANEL_TOKEN>\`

### JSON Response Example
\`\`\`json
{
  "success": true,
  "message": "Action start triggered successfully on process 782f9d6c-67ba-4bcf-a192-d61081a293cc"
}
\`\`\`
    `
  },
  {
    id: 'contributing',
    category: 'Community',
    title: 'Contributing Guide',
    content: `
# Contributing to Orbiton

We welcome developers, system admins, and designers from all over the world to join us in making Orbiton the most beautiful and lightweight server control panel!

---

### How You Can Help
1. **Report Bugs & Issue Tracker:**
   * Found a crash or a broken button? Open an issue on GitHub. Please include steps to reproduce, node version, and system log.
2. **Submit Pull Requests (PRs):**
   * Fork the repository, create your feature branch (\`git checkout -b feat/amazing-feature\`), commit your changes, and open a PR.
3. **Write Documentation:**
   * Improve tutorials, correct typos, or add code snippet examples.
4. **Translations:**
   * Help translate the panel interface into more languages (Vietnamese, Spanish, Japanese, etc.).

### Development Norms & Rules
* Follow a clean, modular file structure.
* Keep compiler integrations decoupled from process daemon managers.
* Write robust error catch blocks for child processes.
    `
  },
  {
    id: 'feedback',
    category: 'Community',
    title: 'Submit Feedback & Reviews',
    content: `
# We Value Your Feedback

Help us shape the future of Orbiton! Share your comments, suggest features, rate your experience, or let us know about any performance improvements you would like to see.

---

### Give us a GitHub Star!
If you love using Orbiton, please consider giving us a ⭐ star on our official [GitHub Repository](https://github.com/iamprmgvyt/orbiton). It helps other developers discover the project and keeps the project actively maintained!
    `
  }
];
