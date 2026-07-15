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
  version)
    echo -e "Orbiton Orchestrator v1.14.0"
    ;;
  *)
    show_help
    ;;
esac
