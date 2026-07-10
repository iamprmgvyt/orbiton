#!/bin/bash
# ============================================================
# Orbiton - Auto Install Script for Ubuntu 22/24 LTS
# Run as root: sudo bash install.sh
# ============================================================

set -e

PANEL_DIR="/opt/orbiton"
DATA_DIR="/opt/orbiton-data"
SERVICE_NAME="orbiton"
PORT=3000
SSL_PORT=3443

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'; BOLD='\033[1m'

echo -e "${BLUE}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║         🌐 Orbiton — Auto Installer          ║"
echo "║         Ubuntu 22/24 LTS                     ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# Check root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Please run as root: sudo bash install.sh${NC}"
  exit 1
fi
echo -e "${GREEN}✔ Running as root${NC}"

# Detect distro
DISTRO=$(lsb_release -is 2>/dev/null || echo "Unknown")
CODENAME=$(lsb_release -cs 2>/dev/null || echo "unknown")
echo -e "${GREEN}✔ OS: ${DISTRO} ${CODENAME}${NC}"

# ─── Helper: install packages, skipping unavailable ones ──────
safe_apt_install() {
  for pkg in "$@"; do
    if apt-cache show "$pkg" &>/dev/null 2>&1; then
      apt-get install -y -qq "$pkg" || echo -e "${YELLOW}  ⚠ Could not install ${pkg}, skipping${NC}"
    else
      echo -e "${YELLOW}  ⚠ Package ${pkg} not found, skipping${NC}"
    fi
  done
}

# ─── Update System ─────────────────────────────────────────────
echo -e "\n${YELLOW}[1/8] Updating system...${NC}"
apt-get update -qq
apt-get upgrade -y -qq

# Base packages (all universally available)
apt-get install -y -qq \
  curl wget git build-essential unzip \
  software-properties-common \
  apt-transport-https ca-certificates \
  gnupg lsb-release

# Python packages (names differ across Ubuntu versions)
safe_apt_install python3 python3-pip python3-venv python3-dev

# Create python → python3 symlink if needed
if ! command -v python &>/dev/null && command -v python3 &>/dev/null; then
  ln -sf "$(command -v python3)" /usr/local/bin/python
  echo -e "${GREEN}  ✔ Created python → python3 symlink${NC}"
fi

echo -e "${GREEN}✔ System updated${NC}"

# ─── Node.js LTS ──────────────────────────────────────────────
echo -e "\n${YELLOW}[2/8] Installing Node.js LTS...${NC}"
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - 2>/dev/null
  apt-get install -y -qq nodejs
fi
node_ver=$(node --version)
npm_ver=$(npm --version)
echo -e "${GREEN}✔ Node.js ${node_ver}, npm ${npm_ver}${NC}"

# ─── Java 21 ──────────────────────────────────────────────────
echo -e "\n${YELLOW}[3/8] Installing Java 21...${NC}"
if ! java --version &>/dev/null 2>&1; then
  # Try openjdk-21, fallback to openjdk-17
  if apt-cache show openjdk-21-jdk-headless &>/dev/null 2>&1; then
    apt-get install -y -qq openjdk-21-jdk-headless
  elif apt-cache show openjdk-21-jdk &>/dev/null 2>&1; then
    apt-get install -y -qq openjdk-21-jdk
  else
    echo -e "${YELLOW}  Java 21 not in repos, trying manual install...${NC}"
    # Download OpenJDK 21 directly
    JDK_URL="https://download.java.net/java/GA/jdk21.0.4/99aef36f30be4c0b/7/GPL/openjdk-21.0.4_linux-x64_bin.tar.gz"
    if [ "$(uname -m)" = "aarch64" ]; then
      JDK_URL="https://download.java.net/java/GA/jdk21.0.4/99aef36f30be4c0b/7/GPL/openjdk-21.0.4_linux-aarch64_bin.tar.gz"
    fi
    mkdir -p /opt/java
    wget -q "$JDK_URL" -O /tmp/jdk21.tar.gz
    tar -xzf /tmp/jdk21.tar.gz -C /opt/java
    rm -f /tmp/jdk21.tar.gz
    JDK_DIR=$(ls -d /opt/java/jdk-21* | head -1)
    ln -sf "$JDK_DIR/bin/java"  /usr/local/bin/java
    ln -sf "$JDK_DIR/bin/javac" /usr/local/bin/javac
    export JAVA_HOME="$JDK_DIR"
    echo "export JAVA_HOME=$JDK_DIR" >> /etc/environment
  fi
fi
java_ver=$(java --version 2>&1 | head -1)
echo -e "${GREEN}✔ ${java_ver}${NC}"

# ─── Python 3 ─────────────────────────────────────────────────
echo -e "\n${YELLOW}[4/8] Verifying Python 3...${NC}"
python3_ver=$(python3 --version 2>&1)
# Upgrade pip using get-pip if pip3 not installed
if ! command -v pip3 &>/dev/null; then
  echo -e "${YELLOW}  pip3 not found, installing via get-pip.py...${NC}"
  curl -sS https://bootstrap.pypa.io/get-pip.py | python3
fi
pip3_ver=$(pip3 --version 2>&1 | cut -d' ' -f1-2)
echo -e "${GREEN}✔ ${python3_ver}, ${pip3_ver}${NC}"

# ─── Docker ───────────────────────────────────────────────────
echo -e "\n${YELLOW}[5/8] Installing Docker...${NC}"
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  # Try docker-ce, fallback to docker.io
  if apt-cache show docker-ce &>/dev/null 2>&1; then
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  else
    apt-get install -y -qq docker.io
  fi
  systemctl enable docker --quiet 2>/dev/null || true
  systemctl start  docker         2>/dev/null || true
fi
docker_ver=$(docker --version)
echo -e "${GREEN}✔ ${docker_ver}${NC}"

# ─── Panel Setup ──────────────────────────────────────────────
echo -e "\n${YELLOW}[6/8] Setting up Orbiton...${NC}"
mkdir -p "$PANEL_DIR" "$DATA_DIR/apps" "$PANEL_DIR/certs"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp -r "$SCRIPT_DIR/backend"  "$PANEL_DIR/"
cp -r "$SCRIPT_DIR/frontend" "$PANEL_DIR/"

# Install npm dependencies
cd "$PANEL_DIR/backend"
npm install --omit=dev

# node-pty: try native build, fallback gracefully
npm install node-pty --build-from-source 2>/dev/null || \
npm install node-pty 2>/dev/null || \
echo -e "${YELLOW}  ⚠ node-pty skipped (terminal will use fallback mode)${NC}"

# Create .env
JWT_SECRET=$(openssl rand -hex 32)
cat > "$PANEL_DIR/backend/.env" << EOF
PORT=${PORT}
SSL_PORT=${SSL_PORT}
JWT_SECRET=${JWT_SECRET}
NODE_ENV=production
DATA_DIR=${DATA_DIR}
EOF
chmod 600 "$PANEL_DIR/backend/.env"
echo -e "${GREEN}✔ Orbiton installed to ${PANEL_DIR}${NC}"

# ─── SSL Certificate ──────────────────────────────────────────
echo -e "\n${YELLOW}[7/8] SSL Certificate...${NC}"
echo ""
echo "  [1] Generate self-signed cert (instant, browser warning)"
echo "  [2] Get Let's Encrypt cert   (requires domain + port 80)"
echo "  [3] Skip SSL                 (HTTP only)"
echo ""
read -rp "  Choice [1]: " ssl_choice
ssl_choice="${ssl_choice:-1}"

case "$ssl_choice" in
  1)
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout "$PANEL_DIR/certs/privkey.pem" \
      -out    "$PANEL_DIR/certs/fullchain.pem" \
      -subj "/CN=orbiton/O=Orbiton/C=VN" -quiet 2>/dev/null
    chmod 600 "$PANEL_DIR/certs/privkey.pem"
    echo -e "${GREEN}✔ Self-signed SSL cert generated (10 years)${NC}"
    ;;
  2)
    apt-get install -y -qq certbot 2>/dev/null || safe_apt_install certbot
    read -rp "  Domain (e.g. panel.example.com): " le_domain
    read -rp "  Email: " le_email
    certbot certonly --standalone -d "$le_domain" --email "$le_email" \
      --agree-tos --non-interactive
    ln -sf "/etc/letsencrypt/live/$le_domain/fullchain.pem" "$PANEL_DIR/certs/fullchain.pem"
    ln -sf "/etc/letsencrypt/live/$le_domain/privkey.pem"   "$PANEL_DIR/certs/privkey.pem"
    (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl restart $SERVICE_NAME") | crontab -
    echo -e "${GREEN}✔ Let's Encrypt cert installed for ${le_domain}${NC}"
    ;;
  *)
    echo -e "${YELLOW}  Skipping SSL — HTTP only${NC}"
    ;;
esac

# ─── Systemd Service ──────────────────────────────────────────
echo -e "\n${YELLOW}[8/8] Creating systemd service...${NC}"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Orbiton — Universal App & Server Manager
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=${PANEL_DIR}/backend
ExecStart=/usr/bin/node ${PANEL_DIR}/backend/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=orbiton
Environment=NODE_ENV=production
EnvironmentFile=${PANEL_DIR}/backend/.env

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" --quiet
systemctl start  "$SERVICE_NAME"

# ─── Firewall ─────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
  ufw allow "$PORT"     comment "Orbiton HTTP"  > /dev/null 2>&1 || true
  ufw allow "$SSL_PORT" comment "Orbiton HTTPS" > /dev/null 2>&1 || true
  echo -e "${GREEN}✔ Firewall rules added (ufw)${NC}"
fi

# ─── Done ─────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s4 --max-time 5 ifconfig.me 2>/dev/null || \
            curl -s4 --max-time 5 api.ipify.org 2>/dev/null || \
            hostname -I | awk '{print $1}')

echo -e "\n${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║        ✅ Orbiton Installed!                 ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  ${BOLD}Access:${NC}"
echo -e "  HTTP  → http://${PUBLIC_IP}:${PORT}"
if [ -f "$PANEL_DIR/certs/fullchain.pem" ]; then
  echo -e "  HTTPS → https://${PUBLIC_IP}:${SSL_PORT}"
fi
echo ""
echo -e "  ${BOLD}Login:${NC} admin / admin123"
echo -e "  ${YELLOW}⚠ Change default password immediately!${NC}"
echo ""
echo -e "  ${BOLD}Commands:${NC}"
echo -e "  sudo systemctl status  ${SERVICE_NAME}"
echo -e "  sudo systemctl restart ${SERVICE_NAME}"
echo -e "  sudo journalctl -u ${SERVICE_NAME} -f"
echo ""
