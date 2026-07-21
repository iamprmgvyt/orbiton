#!/bin/bash
# ======================================================================================
# Orbiton System CLI Tool - Global Command Helper
# Created by iamprmgvyt
# ======================================================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'; BOLD='\033[1m'
PANEL_DIR="/opt/orbiton-panel"
DAEMON_DIR="/opt/orbiton-daemon"

show_help() {
  echo -e "${BLUE}${BOLD}🪐 Orbiton System CLI Manager${NC}"
  echo -e "Usage: ${GREEN}orbiton <command> [args]${NC}\n"
  echo -e "Commands:"
  echo -e "  ${GREEN}start${NC}                   : Start Orbiton Panel and Daemon Node services"
  echo -e "  ${GREEN}stop${NC}                    : Stop Orbiton Panel and Daemon Node services"
  echo -e "  ${GREEN}restart${NC}                 : Restart both Orbiton Panel and Daemon Node"
  echo -e "  ${GREEN}status${NC}                  : Show systemd status for Orbiton services"
  echo -e "  ${GREEN}logs${NC}                    : View real-time systemd service output logs"
  echo -e "  ${GREEN}update${NC}                  : Pull the latest updates from GitHub and reload services"
  echo -e "  ${GREEN}apps${NC}                    : List all applications configured on the panel"
  echo -e "  ${GREEN}sysinfo${NC}                 : Display real-time VPS diagnostics (CPU/RAM/Uptime)"
  echo -e "  ${GREEN}ports${NC}                   : List all listening network ports on the system"
  echo -e "  ${GREEN}create-admin <u > <p >${NC}  : Create a new Web Panel admin account"
  echo -e "  ${GREEN}reset-password <u > <p >${NC}: Reset password for a panel user account"
  echo -e "  ${GREEN}fail2ban${NC}                : Install and configure Fail2ban shield for Panel logs"
  echo -e "  ${GREEN}version${NC}                 : Show installed version info"
  echo -e "  ${GREEN}help${NC}                    : Display this options helper menu"
  echo -e "\nCreated by ${YELLOW}iamprmgvyt${NC}"
}

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Please run with sudo or as root: sudo orbiton $1${NC}"
  exit 1
fi

case "$1" in
  start)
    echo -e "${YELLOW}Starting Orbiton services...${NC}"
    systemctl start orbiton-panel 2>/dev/null || true
    systemctl start orbiton-daemon 2>/dev/null || true
    echo -e "${GREEN}✔ Orbiton services started.${NC}"
    ;;
  stop)
    echo -e "${YELLOW}Stopping Orbiton services...${NC}"
    systemctl stop orbiton-panel 2>/dev/null || true
    systemctl stop orbiton-daemon 2>/dev/null || true
    echo -e "${GREEN}✔ Orbiton services stopped.${NC}"
    ;;
  restart)
    echo -e "${YELLOW}Restarting Orbiton Panel and Daemon...${NC}"
    systemctl restart orbiton-panel 2>/dev/null || true
    systemctl restart orbiton-daemon 2>/dev/null || true
    echo -e "${GREEN}✔ Orbiton services restarted successfully.${NC}"
    ;;
  status)
    echo -e "${BLUE}${BOLD}orbiton-panel.service status:${NC}"
    systemctl status orbiton-panel --no-pager || echo -e "${RED}Panel service is not active or installed.${NC}"
    echo -e "\n${BLUE}${BOLD}orbiton-daemon.service status:${NC}"
    systemctl status orbiton-daemon --no-pager || echo -e "${RED}Daemon service is not active or installed.${NC}"
    ;;
  logs)
    echo -e "${YELLOW}Streaming real-time logs (Ctrl+C to exit)...${NC}"
    journalctl -u orbiton-panel -u orbiton-daemon -f -n 50
    ;;
  update)
    # Check if installer script exists to perform the update option
    INSTALLER_SCRIPT="/opt/orbiton-installer/install.sh"
    if [ -f "/usr/local/bin/orbiton-installer" ]; then
      INSTALLER_SCRIPT="/usr/local/bin/orbiton-installer"
    elif [ -f "./install.sh" ]; then
      INSTALLER_SCRIPT="./install.sh"
    fi
    
    echo -e "${YELLOW}Running Orbiton update process...${NC}"
    if [ -f "$INSTALLER_SCRIPT" ]; then
      bash "$INSTALLER_SCRIPT" --update
    else
      # Fallback manual update
      if [ -d "$PANEL_DIR" ]; then
        cd "$PANEL_DIR" && git pull 2>/dev/null || true
        npm install --omit=dev 2>/dev/null || true
        systemctl restart orbiton-panel || true
      fi
      if [ -d "$DAEMON_DIR" ]; then
        cd "$DAEMON_DIR" && git pull 2>/dev/null || true
        npm install --omit=dev 2>/dev/null || true
        systemctl restart orbiton-daemon || true
      fi
      echo -e "${GREEN}✔ Orbiton manually updated successfully.${NC}"
    fi
    ;;
  apps)
    if [ -d "$PANEL_DIR" ]; then
      cd "$PANEL_DIR" && node scripts/list-apps.js
    else
      echo -e "${RED}❌ Web Panel is not installed on this VPS.${NC}"
    fi
    ;;
  sysinfo)
    if [ -d "$PANEL_DIR" ]; then
      cd "$PANEL_DIR" && node scripts/sysinfo.js
    else
      echo -e "${RED}❌ Web Panel is not installed on this VPS.${NC}"
    fi
    ;;
  ports)
    echo -e "${BLUE}${BOLD}Listening Network Ports:${NC}"
    if command -v ss &>/dev/null; then
      ss -tulpn | grep LISTEN
    elif command -v netstat &>/dev/null; then
      netstat -plnt
    else
      echo -e "${RED}Neither 'ss' nor 'netstat' command found.${NC}"
    fi
    ;;
  create-admin)
    if [ -z "$2" ] || [ -z "$3" ]; then
      echo -e "${RED}❌ Usage: sudo orbiton create-admin <username> <password>${NC}"
      exit 1
    fi
    if [ -d "$PANEL_DIR" ]; then
      cd "$PANEL_DIR" && node scripts/create-admin.js "$2" "$3"
    else
      echo -e "${RED}❌ Web Panel is not installed on this VPS.${NC}"
    fi
    ;;
  reset-password)
    if [ -z "$2" ] || [ -z "$3" ]; then
      echo -e "${RED}❌ Usage: sudo orbiton reset-password <username> <new_password>${NC}"
      exit 1
    fi
    if [ -d "$PANEL_DIR" ]; then
      cd "$PANEL_DIR" && node scripts/reset-password.js "$2" "$3"
    else
      echo -e "${RED}❌ Web Panel is not installed on this VPS.${NC}"
    fi
    ;;
  fail2ban)
    echo -e "${YELLOW}Configuring Fail2ban protection for Orbiton Panel...${NC}"
    if ! command -v fail2ban-client &>/dev/null; then
      echo -e "${YELLOW}Fail2ban is not installed. Installing...${NC}"
      apt-get update -qq && apt-get install -y fail2ban
    fi
    
    # 1. Create Orbiton filter
    echo -e "${YELLOW}Creating Fail2ban filter rules for Orbiton logs...${NC}"
    cat << 'EOF' > /etc/fail2ban/filter.d/orbiton.conf
[Definition]
failregex = ^\[.*\] \[Orbiton-Security\] \[(?:RATE_LIMIT_STRIKE|LOGIN_FAILED)\] IP=<ADDR> .*
ignoreregex =
EOF

    # 2. Create Orbiton jail configuration
    echo -e "${YELLOW}Creating Fail2ban jail configuration...${NC}"
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

    echo -e "${YELLOW}Restarting Fail2ban service...${NC}"
    systemctl restart fail2ban
    systemctl enable fail2ban --quiet
    
    echo -e "${GREEN}✔ Fail2ban security jail configured and activated successfully!${NC}"
    echo -e "  - Logs monitored: ${BOLD}/opt/orbiton-data/security.log${NC}"
    echo -e "  - Fail2ban will automatically block IPs after 5 security/rate-limit strikes for 30 minutes."
    echo -e "  - Status check:   ${BOLD}fail2ban-client status orbiton${NC}"
    ;;
  version)
    echo -e "Orbiton Orchestrator v1.27.0"
    ;;
  *)
    show_help
    ;;
esac
