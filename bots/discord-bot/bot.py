# ============================================================
# Orbiton Discord Bot - Python Version
# Remotely control and monitor Orbiton processes via Discord.
# ============================================================
import os
import requests
import discord
from discord import app_commands
from dotenv import load_dotenv

# Load env configurations
load_dotenv()

DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
GUILD_ID = os.getenv("GUILD_ID")
PANEL_URL = os.getenv("PANEL_URL")
PANEL_USERNAME = os.getenv("PANEL_USERNAME")
PANEL_PASSWORD = os.getenv("PANEL_PASSWORD")

if not DISCORD_TOKEN or not PANEL_URL or not PANEL_USERNAME or not PANEL_PASSWORD:
    print("❌ Missing configurations in .env file!")
    exit(1)

# Discord Client Setup
class OrbitonClient(discord.Client):
    def __init__(self):
        intents = discord.Intents.default()
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self):
        if GUILD_ID:
            guild = discord.Object(id=int)
            try:
                guild.id = int(GUILD_ID)
                self.tree.copy_global_to(guild=guild)
                await self.tree.sync(guild=guild)
                print(f"✅ Synced commands to guild: {GUILD_ID}")
            except ValueError:
                await self.tree.sync()
                print("✅ Synced commands globally (Guild ID parsing failed).")
        else:
            await self.tree.sync()
            print("✅ Synced commands globally.")

client = OrbitonClient()
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

@client.event
async def on_ready():
    print(f"🤖 Logged in as Discord Bot: {client.user.name} (Python)")
    await client.change_presence(activity=discord.Game(name="Orbiton Panel"))
    authenticate()

# Slash command: status
@client.tree.command(name="status", description="Lists all hosted applications and active states.")
async def status_cmd(interaction: discord.Interaction):
    await interaction.response.defer()
    try:
        apps = api_request("/api/apps")
        embed = discord.Embed(
            title="🪐 Orbiton Apps Status",
            color=discord.Color.from_rgb(139, 92, 246),
            description="Current running state of application instances:"
        )
        embed.set_footer(text="🤖 Orbiton Controller Bot | Created by iamprmgvyt")

        if not apps:
            embed.add_field(name="No Applications", value="There are no apps hosted on this panel.")
        else:
            for app in apps:
                status_emoji = "🟢 Running" if app.get("liveStatus") == "running" else "🔴 Stopped"
                embed.add_field(
                    name=f"{app.get('name')} ({app.get('id')[:8]}...)",
                    value=f"• **Status:** {status_emoji}\n• **Runtime:** `{app.get('runtime')}`\n• **Owner:** `{app.get('owner_name')}`",
                    inline=False
                )

        await interaction.followup.send(embed=embed)
    except Exception as e:
        error_embed = discord.Embed(title="❌ Command Execution Failed", color=discord.Color.red(), description=str(e))
        error_embed.set_footer(text="🤖 Orbiton Controller Bot | Created by iamprmgvyt")
        await interaction.followup.send(embed=error_embed)

# Slash command: control
@client.tree.command(name="control", description="Send execution power commands to a hosted application.")
@app_commands.describe(app_id="The ID of the target application", action="Action to execute")
@app_commands.choices(action=[
    app_commands.Choice(name="Start", value="start"),
    app_commands.Choice(name="Stop", value="stop"),
    app_commands.Choice(name="Restart", value="restart"),
    app_commands.Choice(name="Kill", value="kill")
])
async def control_cmd(interaction: discord.Interaction, app_id: str, action: str):
    await interaction.response.defer()
    try:
        api_request(f"/api/apps/{app_id}/{action}", method="POST")
        embed = discord.Embed(
            title="⚡ Process Action Dispatched",
            color=discord.Color.from_rgb(16, 185, 129),
            description=f"Successfully sent **{action.upper()}** command to application **{app_id}**."
        )
        embed.set_footer(text="🤖 Orbiton Controller Bot | Created by iamprmgvyt")
        await interaction.followup.send(embed=embed)
    except Exception as e:
        error_embed = discord.Embed(title="❌ Command Execution Failed", color=discord.Color.red(), description=str(e))
        error_embed.set_footer(text="🤖 Orbiton Controller Bot | Created by iamprmgvyt")
        await interaction.followup.send(embed=error_embed)

# Slash command: stats
@client.tree.command(name="stats", description="Display resource utilization of the VPS host node.")
async def stats_cmd(interaction: discord.Interaction):
    await interaction.response.defer()
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

        embed = discord.Embed(
            title="📊 Host VPS Resource Utilization",
            color=discord.Color.from_rgb(59, 130, 246)
        )
        embed.add_field(name="🖥️ CPU Usage", value=f"`{cpu_usage}%` ({cpu_cores} Cores)", inline=True)
        embed.add_field(name="💾 Memory", value=f"`{mem_pct}%` ({mem_used}MB / {mem_total}MB)", inline=True)
        embed.add_field(name="💿 OS Info", value=f"`{distro}` ({arch})", inline=False)
        embed.add_field(name="⏱️ Uptime", value=f"`{uptime} Hours`", inline=True)
        embed.set_footer(text="🤖 Orbiton Controller Bot | Created by iamprmgvyt")

        await interaction.followup.send(embed=embed)
    except Exception as e:
        error_embed = discord.Embed(title="❌ Command Execution Failed", color=discord.Color.red(), description=str(e))
        error_embed.set_footer(text="🤖 Orbiton Controller Bot | Created by iamprmgvyt")
        await interaction.followup.send(embed=error_embed)

client.run(DISCORD_TOKEN)
