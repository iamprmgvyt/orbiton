#!/bin/bash
# ============================================================
# VPS Panel - Auto Install Script for Ubuntu 24 LTS
# Run as root: sudo bash install.sh
# ============================================================

set -e

PANEL_DIR="/opt/vps-panel"
DATA_DIR="/opt/vps-panel-data"
SERVICE_NAME="vps-panel"
PORT=3000
SSL_PORT=3443

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'; BOLD='\033[1m'

echo -e "${BLUE}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║        VPS Panel - Auto Installer            ║"
echo "║        Ubuntu 24 LTS                         ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# Check root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Please run as root: sudo bash install.sh${NC}"
  exit 1
fi

echo -e "${GREEN}✔ Running as root${NC}"

# ─── Update System ─────────────────────────────────────────────
echo -e "\n${YELLOW}[1/8] Updating system...${NC}"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget git build-essential unzip software-properties-common \
  apt-transport-https ca-certificates gnupg lsb-release python3-is-python \
  python3-pip python3-venv

echo -e "${GREEN}✔ System updated${NC}"

# ─── Node.js LTS ──────────────────────────────────────────────
echo -e "\n${YELLOW}[2/8] Installing Node.js LTS...${NC}"
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y -qq nodejs
fi
node_ver=$(node --version)
npm_ver=$(npm --version)
echo -e "${GREEN}✔ Node.js ${node_ver}, npm ${npm_ver}${NC}"

# ─── Java 21 ──────────────────────────────────────────────────
echo -e "\n${YELLOW}[3/8] Installing Java 21...${NC}"
if ! java --version &>/dev/null 2>&1; then
  apt-get install -y -qq openjdk-21-jdk
fi
java_ver=$(java --version 2>&1 | head -1)
echo -e "${GREEN}✔ ${java_ver}${NC}"

# ─── Python 3 full ────────────────────────────────────────────
echo -e "\n${YELLOW}[4/8] Installing Python 3 full...${NC}"
apt-get install -y -qq python3 python3-pip python3-venv python3-dev
python3_ver=$(python3 --version)
pip3_ver=$(pip3 --version | cut -d' ' -f1-2)
echo -e "${GREEN}✔ ${python3_ver}, ${pip3_ver}${NC}"

# ─── Docker ───────────────────────────────────────────────────
echo -e "\n${YELLOW}[5/8] Installing Docker...${NC}"
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker --quiet
  systemctl start docker
fi
docker_ver=$(docker --version)
echo -e "${GREEN}✔ ${docker_ver}${NC}"

# ─── Panel Setup ──────────────────────────────────────────────
echo -e "\n${YELLOW}[6/8] Setting up VPS Panel...${NC}"
mkdir -p "$PANEL_DIR" "$DATA_DIR/bots" "$PANEL_DIR/certs"

# Copy panel files
cp -r "$(dirname "$0")/backend"  "$PANEL_DIR/"
cp -r "$(dirname "$0")/frontend" "$PANEL_DIR/"

# Install dependencies
cd "$PANEL_DIR/backend"
npm install --omit=dev

# node-pty needs Python and build tools
npm install node-pty --build-from-source || npm install node-pty

# Create .env
cat > "$PANEL_DIR/backend/.env" << EOF
PORT=${PORT}
SSL_PORT=${SSL_PORT}
JWT_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
EOF

echo -e "${GREEN}✔ Panel files installed${NC}"

# ─── SSL Certificate ──────────────────────────────────────────
echo -e "\n${YELLOW}[7/8] SSL Certificate setup...${NC}"
read -rp "Generate self-signed SSL cert? [Y/n]: " ssl_choice
ssl_choice="${ssl_choice:-Y}"

if [[ "$ssl_choice" =~ ^[Yy]$ ]]; then
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$PANEL_DIR/certs/privkey.pem" \
    -out    "$PANEL_DIR/certs/fullchain.pem" \
    -subj "/CN=vps-panel/O=VPS Panel/C=VN" \
    -quiet
  echo -e "${GREEN}✔ Self-signed SSL cert generated (valid 10 years)${NC}"
  echo -e "${YELLOW}  Tip: Replace with Let's Encrypt cert for production!${NC}"
fi

read -rp "Setup Let's Encrypt cert? [y/N]: " le_choice
if [[ "$le_choice" =~ ^[Yy]$ ]]; then
  apt-get install -y -qq certbot
  read -rp "Enter your domain (e.g. panel.example.com): " domain
  read -rp "Enter your email: " email
  certbot certonly --standalone -d "$domain" --email "$email" \
    --agree-tos --non-interactive
  ln -sf "/etc/letsencrypt/live/$domain/fullchain.pem" "$PANEL_DIR/certs/fullchain.pem"
  ln -sf "/etc/letsencrypt/live/$domain/privkey.pem"   "$PANEL_DIR/certs/privkey.pem"
  # Auto-renew
  (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl restart $SERVICE_NAME") | crontab -
  echo -e "${GREEN}✔ Let's Encrypt cert installed for ${domain}${NC}"
fi

# ─── Systemd Service ──────────────────────────────────────────
echo -e "\n${YELLOW}[8/8] Creating systemd service...${NC}"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=VPS Bot Management Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${PANEL_DIR}/backend
ExecStart=/usr/bin/node ${PANEL_DIR}/backend/server.js
Restart=always
RestartSec=5
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
  ufw allow "$PORT"    comment "VPS Panel HTTP"  > /dev/null 2>&1 || true
  ufw allow "$SSL_PORT" comment "VPS Panel HTTPS" > /dev/null 2>&1 || true
  echo -e "${GREEN}✔ Firewall rules added${NC}"
fi

# ─── Done! ────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s4 ifconfig.me || hostname -I | awk '{print $1}')

echo -e "\n${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║       ✅ VPS Panel Installed!                ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  ${BOLD}Access URL:${NC}"
echo -e "  HTTP  → http://${PUBLIC_IP}:${PORT}"
echo -e "  HTTPS → https://${PUBLIC_IP}:${SSL_PORT}"
echo ""
echo -e "  ${BOLD}Default Login:${NC}  admin / admin123"
echo -e "  ${YELLOW}⚠ Change the default password immediately!${NC}"
echo ""
echo -e "  ${BOLD}Commands:${NC}"
echo -e "  sudo systemctl status  ${SERVICE_NAME}"
echo -e "  sudo systemctl restart ${SERVICE_NAME}"
echo -e "  sudo journalctl -u ${SERVICE_NAME} -f"
echo ""
