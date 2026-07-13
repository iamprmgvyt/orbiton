#!/bin/bash
######################################################################################
#                                                                                    #
# Project 'orbiton-installer'                                                        #
#                                                                                    #
# Copyright (C) 2026, iamprmgvyt <iamprmgvyt@github.com>                             #
#                                                                                    #
#   This program is free software: you can redistribute it and/or modify             #
#   it under the terms of the GNU General Public License as published by             #
#   the Free Software Foundation, either version 3 of the License.                  #
#                                                                                    #
#   This script is not associated with the official Pterodactyl Project.             #
#                                                                                    #
######################################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PANEL_DIR="/opt/orbiton-panel"
DAEMON_DIR="/opt/orbiton-daemon"
DATA_DIR="/opt/orbiton-data"
LOG_PATH="/var/log/orbiton-installer.log"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'; BOLD='\033[1m'

echo -e "\n\n* orbiton-installer started on $(date) \n\n" >> $LOG_PATH

# ─── Check Root ───────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Please run as root: sudo bash install.sh${NC}"
  exit 1
fi

welcome() {
  echo -e "${BLUE}${BOLD}"
  echo "  ______   .______      .______    __  ___________.  ______   .__   __. "
  echo " /  __  \\  |   _  \\     |   _  \\  |  | |           | /  __  \\  |  \\ |  | "
  echo "|  |  |  | |  |_)  |    |  |_)  | |  | \`---|  |---\`|  |  |  | |   \\|  | "
  echo "|  |  |  | |      /     |   _  <  |  |     |  |     |  |  |  | |  . \`  | "
  echo "|  \`--'  | |  |\\  \\----.|  |_)  | |  |     |  |     |  \`--'  | |  |\\   | "
  echo " \\______/  | _| \`._____||______/  |__|     |__|      \\______/  |__| \\__| "
  echo -e "${NC}"
  echo -e "${YELLOW}               — CLI Auto Installer (Ubuntu 22/24 LTS) —${NC}\n"
}


safe_apt_install() {
  for pkg in "$@"; do
    if apt-cache show "$pkg" &>/dev/null 2>&1; then
      apt-get install -y -qq "$pkg" >> $LOG_PATH 2>&1 || echo -e "${YELLOW}  ⚠ Skipping ${pkg}${NC}"
    fi
  done
}

update_system() {
  echo -e "${YELLOW}Updating package repository...${NC}"
  apt-get update -qq >> $LOG_PATH 2>&1
  apt-get install -y -qq curl wget git build-essential unzip ca-certificates gnupg lsb-release >> $LOG_PATH 2>&1
}

install_node() {
  if ! command -v node &>/dev/null; then
    echo -e "${YELLOW}Installing Node.js LTS...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> $LOG_PATH 2>&1
    apt-get install -y -qq nodejs >> $LOG_PATH 2>&1
  fi
  echo -e "${GREEN}✔ Node.js $(node --version) installed${NC}"
}

install_docker() {
  if ! command -v docker &>/dev/null; then
    echo -e "${YELLOW}Installing Docker Container Engine...${NC}"
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg >> $LOG_PATH 2>&1
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -qq >> $LOG_PATH 2>&1
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io >> $LOG_PATH 2>&1
    systemctl enable docker --quiet 2>/dev/null || true
    systemctl start docker 2>/dev/null || true
  fi
  echo -e "${GREEN}✔ Docker $(docker --version) installed${NC}"
}

install_java_python() {
  echo -e "${YELLOW}Checking Java and Python environments...${NC}"
  safe_apt_install python3 python3-pip python3-venv openjdk-21-jdk-headless
}

generate_ssl() {
  mkdir -p "$PANEL_DIR/certs"
  if ! openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$PANEL_DIR/certs/privkey.pem" \
    -out    "$PANEL_DIR/certs/fullchain.pem" \
    -subj "/CN=orbiton/O=Orbiton/C=VN" -quiet 2>/dev/null; then
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout "$PANEL_DIR/certs/privkey.pem" \
      -out    "$PANEL_DIR/certs/fullchain.pem" \
      -subj "/CN=orbiton" || true
  fi
  chmod 600 "$PANEL_DIR/certs/privkey.pem" 2>/dev/null || true
  chmod 644 "$PANEL_DIR/certs/fullchain.pem" 2>/dev/null || true
  echo -e "${GREEN}✔ Generated self-signed SSL certs${NC}"
}

letsencrypt_ssl() {
  apt-get install -y -qq certbot >> $LOG_PATH 2>&1
  read -rp "  Domain (e.g. panel.example.com): " le_domain
  read -rp "  Email: " le_email
  certbot certonly --standalone -d "$le_domain" --email "$le_email" --agree-tos --non-interactive >> $LOG_PATH 2>&1
  mkdir -p "$PANEL_DIR/certs"
  ln -sf "/etc/letsencrypt/live/$le_domain/fullchain.pem" "$PANEL_DIR/certs/fullchain.pem"
  ln -sf "/etc/letsencrypt/live/$le_domain/privkey.pem"   "$PANEL_DIR/certs/privkey.pem"
  echo -e "${GREEN}✔ Let's Encrypt certificate configured for ${le_domain}${NC}"
}

install_panel() {
  echo -e "\n${YELLOW}🛠️ Installing Orbiton Panel...${NC}"
  update_system
  install_node

  mkdir -p "$PANEL_DIR"
  cp -r "$SCRIPT_DIR/panel/"* "$PANEL_DIR/"
  
  # Install deps
  cd "$PANEL_DIR"
  npm install --omit=dev >> $LOG_PATH 2>&1

  # Create .env
  JWT_SECRET=$(openssl rand -hex 32)
  DAEMON_TOKEN="orbiton_daemon_secret_$(openssl rand -hex 16)"
  cat > "$PANEL_DIR/.env" << EOF
PORT=3000
SSL_PORT=3443
JWT_SECRET=${JWT_SECRET}
NODE_ENV=production
DISABLE_SSL=true
DAEMON_URL=http://localhost:8080
DAEMON_TOKEN=${DAEMON_TOKEN}
EOF
  chmod 600 "$PANEL_DIR/.env"

  # Systemd
  cat > "/etc/systemd/system/orbiton-panel.service" << EOF
[Unit]
Description=Orbiton Panel - Central Manager
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${PANEL_DIR}
ExecStart=/usr/bin/node ${PANEL_DIR}/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=orbiton-panel
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable orbiton-panel --quiet
  systemctl start orbiton-panel
  echo -e "${GREEN}✔ Orbiton Panel daemon started!${NC}"
}

install_daemon() {
  echo -e "\n${YELLOW}🛠️ Installing Orbiton Daemon (Wings equivalent)...${NC}"
  update_system
  install_node
  install_docker
  install_java_python

  mkdir -p "$DAEMON_DIR" "$DATA_DIR/apps"
  cp -r "$SCRIPT_DIR/daemon/"* "$DAEMON_DIR/"

  # Install deps
  cd "$DAEMON_DIR"
  npm install --omit=dev >> $LOG_PATH 2>&1
  npm install node-pty --build-from-source >> $LOG_PATH 2>&1 || npm install node-pty >> $LOG_PATH 2>&1 || true

  # Fetch or create DAEMON_TOKEN
  DAEMON_TOKEN="orbiton_daemon_secret_$(openssl rand -hex 16)"
  if [ -f "$PANEL_DIR/.env" ]; then
    # link AIO token
    DAEMON_TOKEN=$(grep DAEMON_TOKEN "$PANEL_DIR/.env" | cut -d '=' -f2)
  fi

  cat > "$DAEMON_DIR/.env" << EOF
PORT=8080
DAEMON_TOKEN=${DAEMON_TOKEN}
DATA_DIR=${DATA_DIR}
NODE_ENV=production
EOF
  chmod 600 "$DAEMON_DIR/.env"

  # Systemd
  cat > "/etc/systemd/system/orbiton-daemon.service" << EOF
[Unit]
Description=Orbiton Daemon (Wings) - Node Manager
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=${DAEMON_DIR}
ExecStart=/usr/bin/node ${DAEMON_DIR}/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=orbiton-daemon
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable orbiton-daemon --quiet
  systemctl start orbiton-daemon
  echo -e "${GREEN}✔ Orbiton Daemon (Wings) started on port 8080!${NC}"
}

uninstall_orbiton() {
  echo -e "\n${RED}🛑 Uninstalling Orbiton Panel and Daemon...${NC}"
  systemctl stop orbiton-panel --quiet 2>/dev/null || true
  systemctl disable orbiton-panel --quiet 2>/dev/null || true
  systemctl stop orbiton-daemon --quiet 2>/dev/null || true
  systemctl disable orbiton-daemon --quiet 2>/dev/null || true
  
  rm -f /etc/systemd/system/orbiton-panel.service
  rm -f /etc/systemd/system/orbiton-daemon.service
  systemctl daemon-reload

  rm -rf "$PANEL_DIR" "$DAEMON_DIR"
  echo -n "* Do you want to delete application data database/files at $DATA_DIR? (y/N): "
  read -r rm_data
  if [[ "$rm_data" =~ [Yy] ]]; then
    rm -rf "$DATA_DIR"
    echo -e "${GREEN}✔ Application data removed.${NC}"
  fi
  echo -e "${GREEN}✔ Orbiton uninstalled successfully!${NC}"
  echo -e "${YELLOW}Thank you for using Orbiton!${NC}\n"
  exit 0
}

welcome

done=false
while [ "$done" == false ]; do
  options=(
    "Install both Panel and Daemon (All-in-One on the same machine)"
    "Install Panel only (Central UI & User Database)"
    "Install Daemon only (Wings Agent on Node VPS)"
    "Configure Let's Encrypt SSL certificate"
    "Uninstall Panel & Daemon"
  )

  for i in "${!options[@]}"; do
    echo -e "  [${GREEN}$i${NC}] ${options[$i]}"
  done

  echo -n -e "\n* Enter option [0-$((${#options[@]} - 1))]: "
  read -r action

  if [ -z "$action" ]; then
    action=0
  fi

  case "$action" in
    0)
      install_panel
      install_daemon
      done=true
      ;;
    1)
      install_panel
      done=true
      ;;
    2)
      install_daemon
      done=true
      ;;
    3)
      letsencrypt_ssl
      done=true
      ;;
    4)
      uninstall_orbiton
      done=true
      ;;
    *)
      echo -e "${RED}Invalid selection${NC}"
      ;;
  esac
done

echo -e "\n${GREEN}${BOLD}================================================${NC}"
echo -e "${GREEN}${BOLD}🪐 Orbiton Setup Completed Successfully!        ${NC}"
echo -e "${GREEN}${BOLD}================================================${NC}"
PUBLIC_IP=$(curl -s4 ifconfig.me || curl -s4 api.ipify.org || hostname -I | awk '{print $1}')
echo -e "  Panel Access:  ${BOLD}http://${PUBLIC_IP}:3000${NC}"
echo -e "  Default Admin: ${BOLD}Set up on first web browser access${NC}"
echo -e "  Log file:      ${BOLD}$LOG_PATH${NC}"
echo -e "  ${YELLOW}Thank you for choosing Orbiton!${NC}\n"
