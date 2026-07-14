import React, { useEffect, useState, useRef } from 'react';
import { api, fmtDate } from '../utils/api';
import { Terminal as Xterm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io } from 'socket.io-client';
import 'xterm/css/xterm.css';
import { 
  Play, 
  Square, 
  RotateCw, 
  Trash2, 
  Cpu, 
  Terminal as TerminalIcon, 
  Info, 
  ClipboardList, 
  Send, 
  ArrowLeft, 
  Globe, 
  Calendar, 
  ShieldAlert,
  Download,
  Settings as SettingsIcon
} from 'lucide-react';

// ─── Backups Tab Component ─────────────────────────────────────
function BackupsTab({ appId }) {
  const [backups, setBackups] = useState([]);
  const [newBackupName, setNewBackupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchBackups = async () => {
    try {
      const data = await api(`/backups/${appId}`);
      setBackups(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [appId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newBackupName.trim()) return;
    setCreating(true);
    try {
      await api(`/backups/${appId}/create`, 'POST', { name: newBackupName.trim() });
      setNewBackupName('');
      fetchBackups();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (backupId, name) => {
    if (!confirm(`Are you sure you want to restore backup "${name}"? All current files will be replaced.`)) return;
    setRestoring(true);
    try {
      await api(`/backups/${appId}/restore/${backupId}`, 'POST');
      alert('Rollback completed successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async (backupId) => {
    if (!confirm('Are you sure you want to delete this backup? This action is irreversible.')) return;
    try {
      await api(`/backups/${appId}/${backupId}`, 'DELETE');
      fetchBackups();
    } catch (err) {
      alert(err.message);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Create Backup Form */}
      <form onSubmit={handleCreate} className="bg-bg2/20 border border-border/40 rounded-xl p-4 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-[10px] text-muted uppercase font-bold tracking-wider mb-2">Create New Backup</label>
          <input
            type="text"
            required
            placeholder="e.g. Before database migration"
            value={newBackupName}
            onChange={e => setNewBackupName(e.target.value)}
            className="w-full bg-[#030307] border border-border/80 rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={creating || restoring}
          className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2.5 rounded-lg h-[38px] transition-all flex items-center gap-1.5"
        >
          {creating ? 'Creating...' : 'Create Backup'}
        </button>
      </form>

      {/* Backups List */}
      <div className="space-y-4">
        <h4 className="font-bold text-xs text-text2 uppercase tracking-wider">Available Archives</h4>
        {loading ? (
          <div className="text-center text-xs text-muted py-6">Loading archives...</div>
        ) : backups.length === 0 ? (
          <div className="text-center text-xs text-muted py-12 border border-dashed border-border rounded-xl">
            No backups available for this application. Create one above!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {backups.map(b => (
              <div key={b.id} className="bg-bg2/40 border border-border/40 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <span className="block text-sm font-bold text-text">{b.name}</span>
                  <span className="block text-xs text-muted mt-1">
                    Created at {new Date(b.created_at).toLocaleString()} • Size: {formatSize(b.size)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRestore(b.id, b.name)}
                    disabled={restoring || creating}
                    className="bg-green-500/10 hover:bg-green-500/20 text-green-500 font-semibold text-xs px-3 py-1.5 rounded-lg border border-green-500/10 transition-all"
                  >
                    {restoring ? 'Restoring...' : 'Rollback'}
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 p-2 rounded-lg border border-red-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Domains Tab Component ────────────────────────────────────
function DomainsTab({ appId }) {
  const [domains, setDomains] = useState([]);
  const [newDomain, setNewDomain] = useState('');
  const [targetPort, setTargetPort] = useState('');
  const [sslEnabled, setSslEnabled] = useState(false);
  const [binding, setBinding] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDomains = async () => {
    try {
      const data = await api(`/domains/${appId}`);
      setDomains(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
    // Pre-populate target port based on App metadata if possible
    api(`/apps/${appId}`).then(data => {
      if (data && data.env_vars && data.env_vars.PORT) {
        setTargetPort(data.env_vars.PORT);
      }
    }).catch(() => {});
  }, [appId]);

  const handleBind = async (e) => {
    e.preventDefault();
    if (!newDomain.trim() || !targetPort.trim()) return;
    setBinding(true);
    try {
      await api(`/domains/${appId}/bind`, 'POST', {
        domain: newDomain.trim(),
        port: parseInt(targetPort),
        sslEnabled
      });
      setNewDomain('');
      setSslEnabled(false);
      fetchDomains();
      alert(`Domain ${newDomain} bound and proxied successfully!`);
    } catch (err) {
      alert(err.message);
    } finally {
      setBinding(false);
    }
  };

  const handleUnbind = async (domainId) => {
    if (!confirm('Are you sure you want to unbind this domain? Reverse proxy mapping will be deleted.')) return;
    try {
      await api(`/domains/${appId}/${domainId}`, 'DELETE');
      fetchDomains();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bind Domain Form */}
      <form onSubmit={handleBind} className="bg-bg2/20 border border-border/40 rounded-xl p-4 space-y-4">
        <h4 className="font-bold text-xs text-text2 uppercase tracking-wider">Bind Domain & Reverse Proxy</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-muted uppercase font-bold tracking-wider mb-2">Domain Name</label>
            <input
              type="text"
              required
              placeholder="e.g. app.mywebsite.com"
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              className="w-full bg-[#030307] border border-border/80 rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted uppercase font-bold tracking-wider mb-2">Target Port</label>
            <input
              type="number"
              required
              placeholder="e.g. 3000"
              value={targetPort}
              onChange={e => setTargetPort(e.target.value)}
              className="w-full bg-[#030307] border border-border/80 rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 pt-2">
          <label className="flex items-center gap-2 text-xs text-text2 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={sslEnabled}
              onChange={e => setSslEnabled(e.target.checked)}
              className="accent-accent w-4 h-4 rounded"
            />
            Auto-SSL Let's Encrypt Proxy (Ubuntu Nginx VPS only)
          </label>
          <button
            type="submit"
            disabled={binding}
            className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all"
          >
            {binding ? 'Binding...' : 'Bind Domain'}
          </button>
        </div>
      </form>

      {/* Domain list */}
      <div className="space-y-4">
        <h4 className="font-bold text-xs text-text2 uppercase tracking-wider">Active Domain Mappings</h4>
        {loading ? (
          <div className="text-center text-xs text-muted py-6">Loading domains...</div>
        ) : domains.length === 0 ? (
          <div className="text-center text-xs text-muted py-12 border border-dashed border-border rounded-xl">
            No custom domains configured for this application.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {domains.map(d => (
              <div key={d.id} className="bg-bg2/40 border border-border/40 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <span className="block text-sm font-bold text-text hover:text-accent cursor-pointer">{d.domain}</span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded mt-2 border border-green-500/15">
                    {d.ssl_enabled === 1 ? '🔒 HTTPS Let\'s Encrypt' : '🌐 HTTP Standard Proxy'}
                  </span>
                </div>
                <button
                  onClick={() => handleUnbind(d.id)}
                  className="text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 p-2 rounded-lg border border-red-500/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cron Scheduler Tab Component ─────────────────────────────
function CronsTab({ appId }) {
  const [crons, setCrons] = useState([]);
  const [name, setName] = useState('');
  const [expression, setExpression] = useState('0 0 * * *');
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchCrons = async () => {
    try {
      const data = await api(`/crons/${appId}`);
      setCrons(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrons();
  }, [appId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !expression.trim() || !command.trim()) return;
    setSaving(true);
    try {
      await api(`/crons/${appId}`, 'POST', {
        name: name.trim(),
        expression: expression.trim(),
        command: command.trim()
      });
      setName('');
      setExpression('0 0 * * *');
      setCommand('');
      fetchCrons();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cronId) => {
    if (!confirm('Are you sure you want to delete this scheduled task?')) return;
    try {
      await api(`/crons/${appId}/${cronId}`, 'DELETE');
      fetchCrons();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Cron Form */}
      <form onSubmit={handleCreate} className="bg-bg2/20 border border-border/40 rounded-xl p-4 space-y-4">
        <h4 className="font-bold text-xs text-text2 uppercase tracking-wider">Create Cron Task Schedule</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-muted uppercase font-bold tracking-wider mb-2">Task Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Daily Log Cleanup"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#030307] border border-border/80 rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted uppercase font-bold tracking-wider mb-2">Cron Expression</label>
            <input
              type="text"
              required
              placeholder="e.g. 0 0 * * * (At 00:00 everyday)"
              value={expression}
              onChange={e => setExpression(e.target.value)}
              className="w-full bg-[#030307] border border-border/80 rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent font-mono"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-muted uppercase font-bold tracking-wider mb-2">Execute Shell Command</label>
          <input
            type="text"
            required
            placeholder="e.g. rm -rf logs/*.log or npm run build"
            value={command}
            onChange={e => setCommand(e.target.value)}
            className="w-full bg-[#030307] border border-border/80 rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent font-mono"
          />
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all"
          >
            {saving ? 'Creating...' : 'Create Cron Task'}
          </button>
        </div>
      </form>

      {/* Cron list */}
      <div className="space-y-4">
        <h4 className="font-bold text-xs text-text2 uppercase tracking-wider">Scheduled Tasks</h4>
        {loading ? (
          <div className="text-center text-xs text-muted py-6">Loading tasks...</div>
        ) : crons.length === 0 ? (
          <div className="text-center text-xs text-muted py-12 border border-dashed border-border rounded-xl">
            No scheduled cron tasks configured.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {crons.map(c => (
              <div key={c.id} className="bg-bg2/40 border border-border/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="block text-sm font-bold text-text">{c.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                      c.status === 'running' 
                        ? 'bg-green-500/10 text-green-400 border-green-500/15 animate-pulse'
                        : 'bg-surface2 text-muted border-border'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <span className="block text-xs text-muted">
                    Schedule: <code className="bg-bg px-1.5 py-0.5 rounded text-accent font-mono">{c.expression}</code>
                  </span>
                  <span className="block text-xs text-text2">
                    Command: <code className="bg-[#030307] px-2 py-1 rounded text-text2 font-mono break-all">{c.command}</code>
                  </span>
                  {c.last_run && (
                    <span className="block text-[10px] text-muted">Last run: {new Date(c.last_run).toLocaleString()}</span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 p-2 rounded-lg border border-red-500/10 transition-all self-end sm:self-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main AppDetail Page ──────────────────────────────────────
export default function AppDetail({ appId, initialTab = 'console', onBack, onRefreshTrigger }) {
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const fitAddonInstance = useRef(null);
  const socketRef = useRef(null);
  
  const sessionUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = sessionUser.role === 'admin';

  // Settings Form States
  const [cfgName, setCfgName] = useState('');
  const [cfgRuntime, setCfgRuntime] = useState('nodejs');
  const [cfgStartCmd, setCfgStartCmd] = useState('');
  const [cfgInstallCmd, setCfgInstallCmd] = useState('');
  const [cfgMaxRam, setCfgMaxRam] = useState(512);
  const [cfgAutoRestart, setCfgAutoRestart] = useState(true);
  const [cfgEnvVars, setCfgEnvVars] = useState('{}');
  const [saveLoading, setSaveLoading] = useState(false);

  const loadApp = async () => {
    try {
      const data = await api(`/apps/${appId}`);
      setApp(data);
      if (data.permissions && data.permissions.can_console === 0 && activeTab === 'console') {
        setActiveTab('info');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApp();
  }, [appId, onRefreshTrigger]);

  useEffect(() => {
    if (app) {
      setCfgName(app.name || '');
      setCfgRuntime(app.runtime || 'nodejs');
      setCfgStartCmd(app.start_cmd || '');
      setCfgInstallCmd(app.install_cmd || '');
      setCfgMaxRam(app.max_ram || 512);
      setCfgAutoRestart(app.auto_restart === 1);
      setCfgEnvVars(JSON.stringify(app.env_vars || {}, null, 2));
    }
  }, [app]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    let envObj = {};
    try {
      envObj = JSON.parse(cfgEnvVars);
    } catch (_) {
      alert('Invalid Environment Variables JSON syntax.');
      return;
    }
    setSaveLoading(true);
    try {
      await api(`/apps/${appId}`, 'PATCH', {
        name: cfgName,
        runtime: cfgRuntime,
        start_cmd: cfgStartCmd,
        install_cmd: cfgInstallCmd,
        max_ram: parseInt(cfgMaxRam),
        auto_restart: cfgAutoRestart ? 1 : 0,
        env_vars: envObj
      });
      alert('Configuration updated successfully!');
      loadApp();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  // Connect socket for live status
  useEffect(() => {
    if (!app) return;

    const token = localStorage.getItem('token');
    const socket = io({ auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.emit('app:subscribe', { appId });
    
    socket.on('app:status', ({ appId: statusAppId, status }) => {
      if (statusAppId === appId) {
        setApp(prev => prev ? { ...prev, status } : null);
      }
    });

    return () => {
      socket.emit('app:unsubscribe', {});
      socket.disconnect();
    };
  }, [app?.id]);

  // Init Console Terminal & Load Log History
  // Init Console Terminal & Load Log History
  useEffect(() => {
    if (activeTab !== 'console' || !app || !terminalRef.current) return;
    if (app.permissions && app.permissions.can_console === 0) return;

    // Detect theme color settings
    const currentTheme = localStorage.getItem('orbiton_theme') || 'theme-cyberpunk';
    const themes = {
      'theme-cyberpunk': { bg: '#060612', fg: '#f1f5f9', cursor: '#7c3aed' },
      'theme-ocean': { bg: '#030a16', fg: '#e2e8f0', cursor: '#0d9488' },
      'theme-emerald': { bg: '#02140e', fg: '#e6f4ea', cursor: '#10b981' },
      'theme-sakura': { bg: '#150d12', fg: '#faeaf1', cursor: '#ec4899' },
      'theme-nordic': { bg: '#ffffff', fg: '#0f172a', cursor: '#6d28d9' }
    };
    const tConfig = themes[currentTheme] || themes['theme-cyberpunk'];

    const term = new Xterm({
      theme: {
        background: tConfig.bg,
        foreground: tConfig.fg,
        cursor: tConfig.cursor,
        cursorAccent: tConfig.bg
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 13,
      cursorBlink: true
    });
    
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(terminalRef.current);
    fit.fit();

    xtermInstance.current = term;
    fitAddonInstance.current = fit;

    // Smart Auto-scroll state
    let isUserScrolling = false;
    term.onScroll(() => {
      const buffer = 4;
      const isAtBottom = term.buffer.active.viewportY >= term.buffer.active.baseY - buffer;
      isUserScrolling = !isAtBottom;
    });

    const loadHistory = async () => {
      try {
        term.write('\x1b[36m[Orbiton] Loading logs history...\x1b[0m\r\n');
        // Fetch logs directly from Panel local DB history (works offline!)
        const logsData = await api(`/apps/${appId}/logs-history`);
        term.write('\x1bc'); // clear placeholder
        if (logsData && logsData.length > 0) {
          logsData.forEach(item => {
            term.write(item.line.replace(/\r?\n/g, '\r\n') + '\r\n');
          });
        } else {
          term.write('\x1b[33m[Orbiton] No console history found. Launch server daemon to start logs telemetry.\x1b[0m\r\n');
        }
      } catch (err) {
        term.write(`\x1b[31m[Orbiton Error] Failed to load history: ${err.message}\x1b[0m\r\n`);
      }
    };

    loadHistory().then(() => {
      const socket = socketRef.current;
      if (socket) {
        socket.emit('terminal:create', { appId, cols: term.cols, rows: term.rows });
        socket.on('terminal:data', ({ data }) => {
          term.write(data);
          if (!isUserScrolling) {
            term.scrollToBottom();
          }
        });
        term.onData(data => {
          socket.emit('terminal:input', { input: data });
        });
      }
    });

    const handleResize = () => fit.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      term.dispose();
      window.removeEventListener('resize', handleResize);
      const socket = socketRef.current;
      if (socket) {
        socket.off('terminal:data');
      }
    };
  }, [activeTab, app?.id]);

  const handleAction = async (action) => {
    if (action === 'kill') {
      if (!confirm('Are you sure you want to FORCE KILL this process? This might cause data loss.')) return;
    }
    
    const socket = socketRef.current;
    const isConsoleActive = activeTab === 'console' && socket;
    
    if (isConsoleActive) {
      if (action === 'start') {
        socket.emit('terminal:input', { input: app.start_cmd + '\r' });
      } else if (action === 'stop') {
        socket.emit('terminal:input', { input: '\x03' }); // Send Ctrl+C (SIGINT)
      } else if (action === 'restart') {
        socket.emit('terminal:input', { input: '\x03' }); // Send Ctrl+C
        setTimeout(() => {
          socket.emit('terminal:input', { input: app.start_cmd + '\r' });
        }, 1000);
      }
    }

    try {
      await api(`/apps/${appId}/${action}`, 'POST');
      setTimeout(loadApp, 1000);
    } catch (err) {
      if (!isConsoleActive) {
        alert(err.message);
      } else {
        // Reload app status regardless of minor socket timeout API errors
        setTimeout(loadApp, 1000);
      }
    }
  };

  const handleClearConsole = async () => {
    try {
      await api(`/apps/${appId}/logs/clear`, 'POST');
      if (xtermInstance.current) {
        xtermInstance.current.clear();
        xtermInstance.current.write('\x1b[32m[Orbiton] Console screen cleared.\x1b[0m\r\n');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDownloadLogs = async () => {
    try {
      const logsData = await api(`/apps/${appId}/logs-history`);
      if (!logsData || logsData.length === 0) {
        alert('No logs available for download.');
        return;
      }
      const rawText = logsData.map(item => `${item.timestamp} | ${item.line}`).join('\n');
      const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `server-${appId}-console.log`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download logs: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-12 text-center shadow-xl">
        <h3 className="text-lg font-bold text-text">Server not found</h3>
        <button onClick={onBack} className="mt-4 text-accent font-semibold text-sm hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  const isRunning = app.status === 'running' || app.status === 'starting';
  const canPower = app.permissions ? app.permissions.can_power === 1 : true;
  const canConsole = app.permissions ? app.permissions.can_console === 1 : true;
  const canFiles = app.permissions ? app.permissions.can_files === 1 : true;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-text2 hover:text-text bg-surface hover:bg-surface2 border border-border/80 px-4 py-2.5 rounded-xl transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Servers
      </button>

      {/* Detail Header */}
      <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-surface2 border border-border flex items-center justify-center">
            <img 
              src={
                app.runtime === 'nodejs' ? 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg' :
                app.runtime === 'python' || app.runtime === 'python3' ? 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg' :
                app.runtime === 'java' ? 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg' :
                app.runtime === 'docker' || app.runtime === 'docker-compose' ? 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg' :
                app.runtime === 'go' || app.runtime === 'golang' ? 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original-wordmark.svg' :
                app.runtime === 'rust' ? 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-original.svg' :
                'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/codepen/codepen-plain.svg'
              } 
              alt={app.runtime} 
              className="w-8 h-8 object-contain" 
            />
          </div>
          <div>
            <h3 className="text-xl font-bold text-text">{app.name}</h3>
            <p className="text-xs text-muted mt-1">{app.description || 'No description provided'}</p>
            <div className="flex items-center gap-3 mt-3">
              <span className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] px-2.5 py-1 rounded-full border ${
                app.status === 'running'
                  ? 'bg-green-500/10 border-green-500/20 text-green-400'
                  : app.status === 'starting' || app.status === 'stopping'
                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  app.status === 'running' ? 'bg-green-400 animate-pulse' : app.status === 'starting' ? 'bg-yellow-400 animate-spin' : 'bg-red-400'
                }`}></span>
                {app.status === 'running' ? 'RUNNING' : app.status === 'starting' ? 'STARTING' : app.status === 'stopping' ? 'STOPPING' : 'OFFLINE'}
              </span>
              {app.pid && <span className="text-[10px] text-muted font-semibold uppercase tracking-wider bg-surface2 border border-border px-2.5 py-1 rounded-full">PID: {app.pid}</span>}
            </div>
          </div>
        </div>

        {/* Server Daemon Control Actions */}
        {canPower && (
          <div className="flex items-center gap-2">
            {isRunning ? (
              <>
                <button
                  onClick={() => handleAction('stop')}
                  className="bg-yellow-500 hover:bg-yellow-500/90 active:scale-95 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-yellow-500/10 transition-all flex items-center gap-2"
                >
                  <Square className="w-3.5 h-3.5" />
                  Stop Daemon
                </button>
                <button
                  onClick={() => handleAction('restart')}
                  className="bg-accent hover:bg-accent/90 active:scale-95 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-accent/10 transition-all flex items-center gap-2"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Restart
                </button>
              </>
            ) : (
              <button
                onClick={() => handleAction('start')}
                className="bg-green-500 hover:bg-green-500/90 active:scale-95 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-green-500/10 transition-all flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5" />
                Start Daemon
              </button>
            )}
            <button
              onClick={() => handleAction('kill')}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold text-xs px-4 py-2.5 rounded-xl border border-red-500/10 transition-all flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Kill Process
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2 pb-px overflow-x-auto">
        {[
          ...(canConsole ? [{ id: 'console', label: '⌨️ Server Console', icon: TerminalIcon }] : []),
          { id: 'info', label: 'ℹ️ Server Info', icon: Info },
          ...(canFiles ? [
            { id: 'domains', label: '🌐 Domains & Proxy', icon: Globe },
            { id: 'backups', label: '🛡️ Backups & Restore', icon: ClipboardList }
          ] : []),
          { id: 'crons', label: '📅 Cron Scheduler', icon: Calendar },
          { id: 'settings', label: '⚙️ Server Settings', icon: SettingsIcon }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-accent text-accent bg-accent/5'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl relative min-h-[350px] max-w-full overflow-hidden">
        {/* Console Tab */}
        {canConsole && activeTab === 'console' && (
          <div className="space-y-4 max-w-full">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Real-time server terminal and console history</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadLogs}
                  className="text-xs text-text2 hover:text-text font-semibold bg-surface2 hover:bg-border px-3 py-1.5 rounded-lg border border-border/80 transition-all flex items-center gap-1.5"
                  title="Download raw console log history"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Logs
                </button>
                <button
                  onClick={handleClearConsole}
                  className="text-xs text-red-500 hover:text-red-400 font-semibold bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/10 transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Console
                </button>
              </div>
            </div>
            <div className="w-full bg-[#030307] border border-border/80 rounded-xl overflow-hidden p-4">
              <div ref={terminalRef} className="h-[400px]"></div>
            </div>
             <div className="text-[10px] text-muted">
              💡 Tip: You can type interactive commands directly into the terminal console above to send stdin to the running process.
            </div>
          </div>
        )}

        {/* Info Tab */}
        {activeTab === 'info' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Application ID', app.id],
                ['Runtime Environment', app.runtime],
                ['Startup Command', app.start_cmd],
                ['Install Command', app.install_cmd || 'None'],
                ['Memory Allocation Limit', `${app.max_ram} MB`],
                ['Daemon Auto Restart', app.auto_restart ? 'Enabled' : 'Disabled'],
                ['Creation Date', fmtDate(app.created_at)],
                ['Source Import Origin', app.import_source || 'Manual Deploy'],
                ['Process Status', app.status]
              ].map(([k, v], i) => (
                <div key={i} className="bg-bg2/40 border border-border/40 rounded-xl p-4">
                  <span className="block text-[10px] text-muted uppercase font-bold tracking-wider">{k}</span>
                  <span className="block text-sm font-semibold text-text mt-1.5 break-all">{v}</span>
                </div>
              ))}
            </div>

            {app.env_vars && Object.keys(app.env_vars).length > 0 && (
              <div>
                <h4 className="font-bold text-xs text-text2 uppercase tracking-wider mb-2">Process Environment Variables</h4>
                <pre className="w-full bg-[#030307] border border-border/80 rounded-xl p-4 font-mono text-xs text-text2 overflow-x-auto">
                  {JSON.stringify(app.env_vars, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Backups Tab */}
        {canFiles && activeTab === 'backups' && (
          <BackupsTab appId={appId} />
        )}

        {/* Domains Tab */}
        {canFiles && activeTab === 'domains' && (
          <DomainsTab appId={appId} />
        )}

        {/* Cron Scheduler Tab */}
        {activeTab === 'crons' && (
          <CronsTab appId={appId} />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-2xl page-fade-in">
            <div>
              <h3 className="font-bold text-text">Server Configuration Settings</h3>
              <p className="text-xs text-muted mt-1">Modify application runtime options, RAM caps, and environmental configurations.</p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Server Name</label>
                  <input
                    type="text"
                    required
                    disabled={!isAdmin}
                    value={cfgName}
                    onChange={e => setCfgName(e.target.value)}
                    className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Memory Allocation (MB)</label>
                  <input
                    type="number"
                    required
                    disabled={!isAdmin}
                    value={cfgMaxRam}
                    onChange={e => setCfgMaxRam(e.target.value)}
                    className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Runtime Environment</label>
                  <select
                    value={cfgRuntime}
                    disabled={!isAdmin}
                    onChange={e => setCfgRuntime(e.target.value)}
                    className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="nodejs">Node.js</option>
                    <option value="python">Python</option>
                    <option value="java">Java (OpenJDK)</option>
                    <option value="docker">Docker</option>
                    <option value="bash">Shell/Bash</option>
                    <option value="custom">Custom Command</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Startup Command</label>
                  <input
                    type="text"
                    required
                    value={cfgStartCmd}
                    onChange={e => setCfgStartCmd(e.target.value)}
                    className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Install Command (Optional)</label>
                <input
                  type="text"
                  value={cfgInstallCmd}
                  onChange={e => setCfgInstallCmd(e.target.value)}
                  placeholder="e.g. npm install"
                  className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Environment Variables (JSON)</label>
                <textarea
                  value={cfgEnvVars}
                  onChange={e => setCfgEnvVars(e.target.value)}
                  rows="5"
                  className="w-full bg-bg border border-border focus:border-accent text-text font-mono rounded-xl p-3 outline-none transition-colors text-sm"
                ></textarea>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="cfg-auto-restart"
                  disabled={!isAdmin}
                  checked={cfgAutoRestart}
                  onChange={e => setCfgAutoRestart(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent w-4 h-4 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <label htmlFor="cfg-auto-restart" className="text-xs font-bold text-text2 uppercase tracking-wider cursor-pointer select-none">
                  Enable Daemon Auto-Restart
                </label>
              </div>

              {app.status === 'running' && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-4 rounded-xl text-xs flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                  <span>Warning: Stop the application process first before saving new configuration changes.</span>
                </div>
              )}

              <button
                type="submit"
                disabled={saveLoading || app.status === 'running'}
                className="bg-accent hover:bg-accent/90 active:scale-95 text-white font-semibold text-sm px-5 py-3 rounded-xl shadow-lg shadow-accent/15 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveLoading ? 'Saving...' : 'Save Configuration'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
