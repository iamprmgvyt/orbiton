# ============================================================
# Orbiton Telegram Bot - Python Controller
// Remotely control and monitor Orbiton processes via Telegram.
# ============================================================
import os
import requests
import telebot
from dotenv import load_dotenv

# Load env configurations
load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
PANEL_URL = os.getenv("PANEL_URL")
PANEL_USERNAME = os.getenv("PANEL_USERNAME")
PANEL_PASSWORD = os.getenv("PANEL_PASSWORD")

if not BOT_TOKEN or not PANEL_URL or not PANEL_USERNAME or not PANEL_PASSWORD:
    print("❌ Missing configuration in .env file!")
    exit(1)

bot = telebot.TeleBot(BOT_TOKEN)
jwt_token = ""

# Authenticate with Orbiton Panel API
def authenticate():
    global jwt_token
    try:
        url = f"{PANEL_URL}/api/auth/login"
        payload = {"username": PANEL_USERNAME, "password": PANEL_PASSWORD}
        r = requests.post(url, json=payload, timeout=5)
        r.raise_for_status()
        jwt_token = r.json().get("token", "")
        print("🔑 Authenticated successfully with Orbiton Panel.")
        return True
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        return False

# Safe API Request wrapper with auto-reauth
def api_request(endpoint, method="GET", json_data=None):
    global jwt_token
    if not jwt_token:
        authenticate()
    
    headers = {"Authorization": f"Bearer {jwt_token}"}
    url = f"{PANEL_URL}{endpoint}"

    try:
        if method == "GET":
            r = requests.get(url, headers=headers, timeout=5)
        else:
            r = requests.post(url, headers=headers, json=json_data, timeout=5)

        if r.status_code in [401, 403]:
            print("🔄 Token expired, re-authenticating...")
            if authenticate():
                headers["Authorization"] = f"Bearer {jwt_token}"
                if method == "GET":
                    r = requests.get(url, headers=headers, timeout=5)
                else:
                    r = requests.post(url, headers=headers, json=json_data, timeout=5)
        
        r.raise_for_status()
        return r.json()
    except Exception as e:
        raise e

# /start or /help handler
@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    help_text = (
        "🪐 *Welcome to Orbiton Controller Bot!*\n\n"
        "Available commands:\n"
        "• `/status` — List all hosted applications and states\n"
        "• `/control <app-id> <action>` — Control app (`start`, `stop`, `restart`, `kill`)\n"
        "• `/vps` — Display VPS server resource utilization\n\n"
        "🤖 _Orbiton Controller Bot | Created by iamprmgvyt_"
    )
    bot.reply_to(message, help_text, parse_mode="Markdown")

# /status handler
@bot.message_handler(commands=['status'])
def get_status(message):
    try:
        apps = api_request("/api/apps")
        if not apps:
            bot.reply_to(message, "🪐 *Orbiton Status*\nNo applications hosted on this panel.\n\n🤖 _Orbiton Controller Bot | Created by iamprmgvyt_", parse_mode="Markdown")
            return

        text = "🪐 *Orbiton Apps Status*\n\n"
        for app in apps:
            status_emoji = "🟢 Running" if app.get("liveStatus") == "running" else "🔴 Stopped"
            text += f"• *{app.get('name')}* (`{app.get('id')[:8]}...`)\n"
            text += f"  Status: {status_emoji} | Runtime: `{app.get('runtime')}`\n\n"
        
        text += "🤖 _Orbiton Controller Bot | Created by iamprmgvyt_"
        bot.reply_to(message, text, parse_mode="Markdown")
    except Exception as e:
        bot.reply_to(message, f"❌ Failed to fetch apps status: {e}")

# /control handler
@bot.message_handler(commands=['control'])
def control_app(message):
    args = message.text.split()
    if len(args) < 3:
        bot.reply_to(message, "⚠ Usage: `/control <app-id> <start|stop|restart|kill>`", parse_mode="Markdown")
        return

    app_id = args[1]
    action = args[2].lower()

    if action not in ['start', 'stop', 'restart', 'kill']:
        bot.reply_to(message, "❌ Invalid action! Select: start, stop, restart, or kill.")
        return

    try:
        api_request(f"/api/apps/{app_id}/{action}", method="POST")
        response_text = (
            f"⚡ *Action Dispatched*\n"
            f"Successfully sent *{action.upper()}* command to application `{app_id}`.\n\n"
            f"🤖 _Orbiton Controller Bot | Created by iamprmgvyt_"
        )
        bot.reply_to(message, response_text, parse_mode="Markdown")
    except Exception as e:
        bot.reply_to(message, f"❌ Execution failed: {e}")

# /vps handler
@bot.message_handler(commands=['vps'])
def get_vps_stats(message):
    try:
        stats = api_request("/api/system/stats")
        cpu_usage = stats.get("cpu", {}).get("usage", 0)
        cpu_cores = stats.get("cpu", {}).get("cores", 0)
        mem_pct = stats.get("memory", {}).get("usedPercent", 0)
        mem_used = round(stats.get("memory", {}).get("used", 0) / 1024 / 1024)
        mem_total = round(stats.get("memory", {}).get("total", 0) / 1024 / 1024)
        distro = stats.get("os", {}).get("distro", "N/A")
        arch = stats.get("os", {}).get("arch", "N/A")
        uptime = round(stats.get("os", {}).get("uptime", 0) / 3600)

        stats_text = (
            "📊 *Host VPS Resource Utilization*\n\n"
            f"• *CPU Usage:* `{cpu_usage}%` ({cpu_cores} Cores)\n"
            f"• *Memory:* `{mem_pct}%` ({mem_used}MB / {mem_total}MB)\n"
            f"• *OS:* `{distro}` ({arch})\n"
            f"• *Uptime:* `{uptime} Hours`\n\n"
            "🤖 _Orbiton Controller Bot | Created by iamprmgvyt_"
        )
        bot.reply_to(message, stats_text, parse_mode="Markdown")
    except Exception as e:
        bot.reply_to(message, f"❌ Failed to fetch VPS stats: {e}")

if __name__ == "__main__":
    print("🤖 Telegram Bot is starting polling...")
    authenticate()
    bot.infinity_polling()
