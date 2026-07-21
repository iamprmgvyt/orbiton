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
PANEL_PORT=3000

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
  cat << 'EOF'
   ____    ____    ____     ____    ______   ____    _   __
  / __ \  / __ \  / __ )   /_  _/  /_  __/  / __ \  / | / /
 / / / / /_/ / / / __  |    / /     / /    / / / / /  |/ / 
/ /_/ / / _, _/ / /_/ /   _/ /_    / /    / /_/ / / /|  /  
\____/  /_/ |_| /____/   /___/    /_/     \____/ /_/ |_|   
EOF
  echo -e "${NC}"
  echo -e "${YELLOW}       — CLI Auto Installer (Ubuntu 22/24 LTS) —${NC}\n"
}


setup_swap() {
  local swap_total=$(free -m | awk '/^Swap:/{print $2}')
  if [ -z "$swap_total" ]; then
    swap_total=0
  fi
  
  local ram_total=$(free -m | awk '/^Mem:/{print $2}')
  if [ -z "$ram_total" ]; then
    ram_total=4096
  fi
  
  # Check if RAM is between 512MB and 3GB (3072MB)
  if [ "$ram_total" -ge 500 ] && [ "$ram_total" -le 3100 ]; then
    if [ "$swap_total" -gt 0 ]; then
      echo -e "${GREEN}✔ Swap space already configured (${swap_total}MB). Skipping setup.${NC}"
      return
    fi

    echo -e "\n${YELLOW}⚠️ Low physical memory detected ($ram_total MB RAM).${NC}"
    echo -e "${YELLOW}======================================================================${NC}"
    echo -e "We recommend creating a Swap file (virtual memory) to prevent installer"
    echo -e "bottlenecks and Out-Of-Memory (OOM) system crashes."
    echo -e ""
    echo -e "${BOLD}🔴 IMPORTANT WARNING (Disk Throttling & I/O Bottlenecks):${NC}"
    echo -e "Setting a Swap size too large on shared cloud VPS instances will trigger"
    echo -e "heavy disk read/write throttling from your provider, degrading system"
    echo -e "performance dramatically."
    echo -e ""
    echo -e "${BOLD}📖 Visual Analogy:${NC}"
    echo -e "  If you have a 2GB document folder placed on your desk (small swap),"
    echo -e "  it is very easy and fast to find files when your hands are busy."
    echo -e "  But if you scatter a massive 20GB of documents all over the floor"
    echo -e "  (excessive swap), it will take you ages to search and crawl, slowing"
    echo -e "  down the entire system to a crawl."
    echo -e ""
    echo -e "👉 Recommended Swap Size: ${BOLD}1GB or 2GB${NC}."
    echo -e "${YELLOW}======================================================================${NC}"
    
    echo -n -e "* Would you like to create a Swap file? (y/N): "
    read -r create_swap_choice
    
    if [[ "$create_swap_choice" =~ [Yy] ]]; then
      echo -n -e "  Enter Swap size in GB [1-4, Default: 2]: "
      read -r swap_size_input
      
      # Default to 2 if input is empty or not a number
      if [ -z "$swap_size_input" ] || ! [[ "$swap_size_input" =~ ^[1-9][0-9]*$ ]]; then
        swap_size_input=2
      fi
      
      echo -e "${YELLOW}  Creating a ${swap_size_input}GB Swap file, please wait...${NC}"
      local swap_size_mb=$((swap_size_input * 1024))
      
      # Allocate swap
      fallocate -l ${swap_size_input}G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=${swap_size_mb} >> $LOG_PATH 2>&1
      chmod 600 /swapfile
      mkswap /swapfile >> $LOG_PATH 2>&1
      swapon /swapfile >> $LOG_PATH 2>&1
      
      if ! grep -q "/swapfile" /etc/fstab; then
        echo "/swapfile none swap sw 0 0" >> /etc/fstab
      fi
      echo -e "${GREEN}✔ ${swap_size_input}GB Swap Space successfully created and activated!${NC}\n"
    else
      echo -e "${YELLOW}  Skipping Swap file creation. Proceeding with raw memory...${NC}\n"
    fi
  fi
}

safe_apt_install() {
  for pkg in "$@"; do
    if apt-cache show "$pkg" &>/dev/null 2>&1; then
      apt-get install -y "$pkg" || echo -e "${YELLOW}  ⚠ Skipping ${pkg}${NC}"
    fi
  done
}

update_system() {
  setup_swap
  echo -e "${YELLOW}Updating package repository...${NC}"
  apt-get update -qq >> $LOG_PATH 2>&1
  apt-get install -y curl wget git build-essential unzip ca-certificates gnupg lsb-release
}

install_node() {
  if ! command -v node &>/dev/null; then
    echo -e "${YELLOW}Installing Node.js LTS...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> $LOG_PATH 2>&1
    apt-get install -y nodejs
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
    apt-get install -y docker-ce docker-ce-cli containerd.io
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
  echo -n "* Do you use Cloudflare SSL/TLS Proxy (Flexible/Full) for this domain? (y/N): "
  read -r cf_ssl
  if [[ "$cf_ssl" =~ [Yy] ]]; then
    echo -e "${GREEN}✔ Configuring for Cloudflare Proxy. Orbiton will run on HTTP (port 3000) behind Cloudflare HTTPS.${NC}"
    # Ensure DISABLE_SSL=true in .env
    sed -i 's/DISABLE_SSL=false/DISABLE_SSL=true/g' "$PANEL_DIR/.env" 2>/dev/null || true
    # Remove any local certs to prevent auto SSL activation
    rm -rf "$PANEL_DIR/certs"
    systemctl restart orbiton-panel
    echo -e "${GREEN}✔ Configuration completed! Make sure Cloudflare SSL/TLS mode is set to 'Flexible'.${NC}"
    return
  fi

  # Otherwise install Let's Encrypt
  apt-get install -y -qq certbot >> $LOG_PATH 2>&1
  read -rp "  Domain (e.g. panel.example.com): " le_domain
  read -rp "  Email: " le_email
  certbot certonly --standalone -d "$le_domain" --email "$le_email" --agree-tos --non-interactive >> $LOG_PATH 2>&1
  
  if [ -d "/etc/letsencrypt/live/$le_domain" ]; then
    mkdir -p "$PANEL_DIR/certs"
    ln -sf "/etc/letsencrypt/live/$le_domain/fullchain.pem" "$PANEL_DIR/certs/fullchain.pem"
    ln -sf "/etc/letsencrypt/live/$le_domain/privkey.pem"   "$PANEL_DIR/certs/privkey.pem"
    # Enable SSL in .env
    sed -i 's/DISABLE_SSL=true/DISABLE_SSL=false/g' "$PANEL_DIR/.env" 2>/dev/null || true
    systemctl restart orbiton-panel
    echo -e "${GREEN}✔ Let's Encrypt certificate configured and SSL enabled for ${le_domain}${NC}"
  else
    echo -e "${RED}❌ Let's Encrypt certificate generation failed! Check log: $LOG_PATH${NC}"
  fi
}

configure_fail2ban_auto() {
  echo -e "\n${YELLOW}🛡️ Auto-configuring Fail2ban Shield for Panel logs...${NC}"
  if ! command -v fail2ban-client &>/dev/null; then
    echo -e "${YELLOW}Installing Fail2ban...${NC}"
    apt-get update -qq >> $LOG_PATH 2>&1
    apt-get install -y fail2ban >> $LOG_PATH 2>&1 || echo -e "${YELLOW}  ⚠ Skipping Fail2ban installation${NC}"
  fi

  if command -v fail2ban-client &>/dev/null; then
    # 1. Create Orbiton filter
    cat << 'EOF' > /etc/fail2ban/filter.d/orbiton.conf
[Definition]
failregex = ^\[.*\] \[Orbiton-Security\] \[(?:RATE_LIMIT_STRIKE|LOGIN_FAILED)\] IP=<ADDR> .*
ignoreregex =
EOF

    # 2. Create Orbiton jail configuration
    cat << 'EOF' > /etc/fail2ban/jail.d/orbiton.conf
[orbiton]
enabled = true
port = http,https,3000
filter = orbiton
logpath = /opt/orbiton-data/security.log
maxretry = 5
findtime = 60
bantime = 1800
action = iptables-multiport[name=orbiton, port="http,https,3000"]
EOF

    # Create security.log file if not exists
    mkdir -p /opt/orbiton-data
    touch /opt/orbiton-data/security.log
    chmod 644 /opt/orbiton-data/security.log

    systemctl restart fail2ban >> $LOG_PATH 2>&1 || true
    systemctl enable fail2ban --quiet 2>/dev/null || true
    echo -e "${GREEN}✔ Fail2ban security jail configured and activated automatically!${NC}"
  else
    echo -e "${YELLOW}⚠ Fail2ban could not be installed/configured. Please install it manually if needed.${NC}"
  fi
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

  # Network Port Selection Prompt
  echo -e "\n${YELLOW}* Configure Panel Network Port:${NC}"
  echo -e "  [1] Run directly on Main IP (Port 80)"
  echo -e "  [2] Run on a Custom Port (Default: 3000)"
  echo -n -e "  Select option [1-2, Default: 2]: "
  read -r port_choice

  if [ "$port_choice" == "1" ]; then
    PANEL_PORT=80
    echo -e "  ${GREEN}✔ Panel configured to run on Port 80 (Main IP).${NC}"
  else
    echo -n -e "  Enter custom port [Default: 3000]: "
    read -r custom_port
    if [ ! -z "$custom_port" ]; then
      PANEL_PORT=$custom_port
    else
      PANEL_PORT=3000
    fi
    echo -e "  ${GREEN}✔ Panel configured to run on Port ${PANEL_PORT}.${NC}"
  fi

  # Create .env
  JWT_SECRET=$(openssl rand -hex 32)
  DAEMON_TOKEN="orbiton_daemon_secret_$(openssl rand -hex 16)"
  cat > "$PANEL_DIR/.env" << EOF
PORT=${PANEL_PORT}
SSL_PORT=3443
JWT_SECRET=${JWT_SECRET}
NODE_ENV=production
DISABLE_SSL=true
DAEMON_URL=http://localhost:9900
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
  configure_fail2ban_auto
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
PORT=9900
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
  echo -e "${GREEN}✔ Orbiton Daemon (Wings) started on port 9900!${NC}"
}

update_orbiton() {
  echo -e "\n${YELLOW}🔄 Updating Orbiton Panel & Daemon to the latest version...${NC}"
  
  local clone_dir="$SCRIPT_DIR"
  local temp_created=false
  local TEMP_DIR=""

  if [ ! -d "$SCRIPT_DIR/.git" ]; then
    echo -e "${YELLOW}No local Git repository found. Downloading latest updates from GitHub...${NC}"
    TEMP_DIR=$(mktemp -d)
    if git clone https://github.com/iamprmgvyt/orbiton.git "$TEMP_DIR" >> $LOG_PATH 2>&1; then
      clone_dir="$TEMP_DIR"
      temp_created=true
    else
      echo -e "${RED}❌ Failed to clone latest repository from GitHub. Proceeding with local files...${NC}"
    fi
  else
    echo -e "${YELLOW}Pulling code updates from local Git repository...${NC}"
    cd "$SCRIPT_DIR"
    # Fix Git dubious ownership security check (safe.directory) when running as sudo root
    git config --global --add safe.directory "$SCRIPT_DIR" 2>/dev/null || true
    
    # Stash any local manual modifications to prevent pull block conflicts
    git stash 2>/dev/null || true

    if git pull >> $LOG_PATH 2>&1; then
      echo -e "${GREEN}✔ Successfully pulled updates from GitHub.${NC}"
    else
      # Fallback to force update from remote branch if normal pull fails
      echo -e "${YELLOW}Pull failed. Attempting hard reset from origin...${NC}"
      CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
      if git fetch --all >> $LOG_PATH 2>&1 && git reset --hard "origin/$CURRENT_BRANCH" >> $LOG_PATH 2>&1; then
        echo -e "${GREEN}✔ Successfully synchronized code with origin/$CURRENT_BRANCH.${NC}"
      else
        echo -e "${RED}❌ Failed to pull git updates, proceeding with local files...${NC}"
      fi
    fi
  fi

  if [ -d "$PANEL_DIR" ]; then
    echo -e "${YELLOW}Updating Panel package files...${NC}"
    cp -rf "$clone_dir/panel/"* "$PANEL_DIR/"
    cd "$PANEL_DIR"
    npm install --omit=dev >> $LOG_PATH 2>&1
    systemctl restart orbiton-panel || true
    echo -e "${GREEN}✔ Orbiton Panel updated & restarted.${NC}"
  fi

  if [ -d "$DAEMON_DIR" ]; then
    echo -e "${YELLOW}Updating Daemon package files...${NC}"
    cp -rf "$clone_dir/daemon/"* "$DAEMON_DIR/"
    cd "$DAEMON_DIR"
    npm install --omit=dev >> $LOG_PATH 2>&1
    systemctl restart orbiton-daemon || true
    echo -e "${GREEN}✔ Orbiton Daemon updated & restarted.${NC}"
  fi

  # Register global CLI command as well on update
  if [ -f "$clone_dir/orbiton.sh" ]; then
    cp "$clone_dir/orbiton.sh" /usr/local/bin/orbiton 2>/dev/null || true
    chmod +x /usr/local/bin/orbiton 2>/dev/null || true
  fi

  # Clean up temp dir if created
  if [ "$temp_created" = true ] && [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
  fi

  echo -e "${GREEN}${BOLD}🪐 Orbiton Update Completed Successfully!${NC}\n"
  exit 0
}

install_cli() {
  echo -e "${YELLOW}Registering 'orbiton' global command...${NC}"
  cp "$SCRIPT_DIR/orbiton.sh" /usr/local/bin/orbiton 2>/dev/null || true
  chmod +x /usr/local/bin/orbiton 2>/dev/null || true
  
  # Also keep a copy of the installer so update script works
  mkdir -p /opt/orbiton-installer
  cp "$SCRIPT_DIR/install.sh" /opt/orbiton-installer/install.sh 2>/dev/null || true
  cp "$SCRIPT_DIR/orbiton.sh" /opt/orbiton-installer/orbiton.sh 2>/dev/null || true
  echo -e "${GREEN}✔ You can now run Orbiton CLI commands globally! Try: 'orbiton help'${NC}"
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

if [ "$1" == "--update" ]; then
  update_orbiton
  exit 0
fi

done=false
while [ "$done" == false ]; do
  options=(
    "Install both Panel and Daemon (All-in-One on the same machine)"
    "Install Panel only (Central UI & User Database)"
    "Install Daemon only (Wings Agent on Node VPS)"
    "Configure Let's Encrypt SSL certificate"
    "Configure Fail2ban automatic DDoS/brute-force IP ban shield"
    "Uninstall Panel & Daemon"
    "Update Orbiton to the Latest Version & Restart Services"
    "Cancel / Exit"
  )

  for i in "${!options[@]}"; do
    echo -e "  [${GREEN}$i${NC}] ${options[$i]}"
  done

  echo -n -e "\n* Enter option [0-$((${#options[@]} - 1))]: "
  read -r action

  if [ -z "$action" ]; then
    action=0
  fi

  send_telemetry() {
    curl -s "https://api.counterapi.dev/v1/orbiton/install/up" >/dev/null 2>&1 &
  }

  case "$action" in
    0)
      send_telemetry
      install_panel
      install_daemon
      done=true
      ;;
    1)
      send_telemetry
      install_panel
      done=true
      ;;
    2)
      send_telemetry
      install_daemon
      done=true
      ;;
    3)
      letsencrypt_ssl
      done=true
      ;;
    4)
      if [ -f "/usr/local/bin/orbiton" ]; then
        /usr/local/bin/orbiton fail2ban
      elif [ -f "$SCRIPT_DIR/orbiton.sh" ]; then
        bash "$SCRIPT_DIR/orbiton.sh" fail2ban
      else
        echo -e "${RED}❌ Orbiton is not installed on this system. Install the Panel/Daemon first.${NC}"
      fi
      done=true
      ;;
    5)
      uninstall_orbiton
      done=true
      ;;
    6)
      update_orbiton
      done=true
      ;;
    7)
      echo -e "${YELLOW}Installation cancelled. Thank you for using Orbiton!${NC}\n"
      exit 0
      ;;
    *)
      echo -e "${RED}Invalid selection${NC}"
      ;;
  esac
done

install_cli

echo -e "\n${GREEN}${BOLD}================================================${NC}"
echo -e "${GREEN}${BOLD}🪐 Orbiton Setup Completed Successfully!        ${NC}"
echo -e "${GREEN}${BOLD}================================================${NC}"
PUBLIC_IP=$(curl -s4 ifconfig.me || curl -s4 api.ipify.org || hostname -I | awk '{print $1}')
if [ "$PANEL_PORT" == "80" ]; then
  echo -e "  Panel Access:  ${BOLD}http://${PUBLIC_IP}${NC}"
else
  echo -e "  Panel Access:  ${BOLD}http://${PUBLIC_IP}:${PANEL_PORT}${NC}"
fi
echo -e "  Default Admin: ${BOLD}Set up on first web browser access${NC}"
echo -e "  Log file:      ${BOLD}$LOG_PATH${NC}"
echo -e "  ${YELLOW}Thank you for choosing Orbiton!${NC}\n"
