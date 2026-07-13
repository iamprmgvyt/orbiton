import React, { useEffect, useState, useRef } from 'react';
import { api, fmtDate } from '../utils/api';
import { Terminal as Xterm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io } from 'socket.io-client';
import 'xterm/css/xterm.css';
import { Play, Square, RotateCw, Trash2, Cpu, Terminal as TerminalIcon, Info, ClipboardList, Send, ArrowLeft } from 'lucide-react';

export default function AppDetail({ appId, initialTab = 'console', onBack, onRefreshTrigger }) {
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const fitAddonInstance = useRef(null);
  const socketRef = useRef(null);

  const loadApp = async () => {
    try {
      const data = await api(`/apps/${appId}`);
      setApp(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApp();
  }, [appId, onRefreshTrigger]);

  // Connect socket for live status
  useEffect(() => {
    if (!app) return;

    const token = localStorage.getItem('token');
    const socket = io({ auth: { token } });
    socketRef.current = socket;

    socket.emit('app:subscribe', { appId });
    
    socket.on('app:status', ({ appId: statusAppId, status }) => {
      if (statusAppId === appId) {
        setApp(prev => prev ? { ...prev, liveStatus: status, status } : null);
      }
    });

    return () => {
      socket.emit('app:unsubscribe', {});
      socket.disconnect();
    };
  }, [app?.id]);

  // Init Console Terminal & Load Log History
  useEffect(() => {
    if (activeTab !== 'console' || !app || !terminalRef.current) return;

    // Initialize Xterm
    const term = new Xterm({
      theme: {
        background: '#030307',
        foreground: '#e2e8f0',
        cursor: '#7c3aed'
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

    // Fetch and display log history
    const loadHistory = async () => {
      try {
        term.write('\x1b[36m[Orbiton] Loading logs history...\x1b[0m\r\n');
        const logsData = await api(`/apps/${appId}/logs?lines=300`);
        term.write('\x1bc'); // clear screen
        if (logsData.logs && logsData.logs.length > 0) {
          logsData.logs.forEach(line => {
            term.write(line.replace(/\r?\n/g, '\r\n') + '\r\n');
          });
        } else {
          term.write('\x1b[33m[Orbiton] No console history found. Click "Start Daemon" to begin.\x1b[0m\r\n');
        }
      } catch (err) {
        term.write(`\x1b[31m[Orbiton Error] Failed to load history: ${err.message}\x1b[0m\r\n`);
      }
    };

    loadHistory().then(() => {
      // Connect to Socket IO for live PTY stream
      const socket = socketRef.current;
      if (socket) {
        socket.emit('terminal:create', { appId, cols: term.cols, rows: term.rows });
        
        socket.on('terminal:data', ({ data }) => term.write(data));
        
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
    try {
      await api(`/apps/${appId}/${action}`, 'POST');
      loadApp();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleClearConsole = async () => {
    try {
      await api(`/apps/${appId}/logs/clear`, 'POST');
      if (xtermInstance.current) {
        xtermInstance.current.clear();
        xtermInstance.current.write('\x1b[32m[Orbiton] Console logs cleared.\x1b[0m\r\n');
      }
    } catch (err) {
      alert(err.message);
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

  const isRunning = app.liveStatus === 'running' || app.liveStatus === 'starting';

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
          <div className="w-14 h-14 rounded-2xl bg-surface2 border border-border flex items-center justify-center text-3xl">
            {app.runtime === 'nodejs' ? '🟩' : app.runtime === 'python3' ? '🐍' : app.runtime === 'java' ? '☕' : app.runtime === 'docker' ? '🐳' : '⚙️'}
          </div>
          <div>
            <h3 className="text-xl font-bold text-text">{app.name}</h3>
            <p className="text-xs text-muted mt-1">{app.description || 'No description provided'}</p>
            <div className="flex items-center gap-3 mt-3">
              <span className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] px-2.5 py-1 rounded-full border ${
                app.liveStatus === 'running'
                  ? 'bg-green-500/10 border-green-500/20 text-green-400'
                  : app.liveStatus === 'starting'
                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                <span className={`w-1 h-1 rounded-full ${
                  app.liveStatus === 'running' ? 'bg-green-400 animate-pulse' : app.liveStatus === 'starting' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></span>
                {app.liveStatus}
              </span>
              {app.pid && <span className="text-[10px] text-muted font-semibold uppercase tracking-wider bg-surface2 border border-border px-2.5 py-1 rounded-full">PID: {app.pid}</span>}
            </div>
          </div>
        </div>

        {/* Server Daemon Control Actions */}
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
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2 pb-px overflow-x-auto">
        {[
          { id: 'console', label: '⌨️ Server Console', icon: TerminalIcon },
          { id: 'info', label: 'ℹ️ Server Info', icon: Info }
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
        {activeTab === 'console' && (
          <div className="space-y-4 max-w-full">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Real-time server terminal and console history</span>
              <button
                onClick={handleClearConsole}
                className="text-xs text-red-500 hover:text-red-400 font-semibold bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/10 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Console
              </button>
            </div>
            <div className="w-full bg-[#030307] border border-border/80 rounded-xl overflow-hidden p-4">
              <div ref={terminalRef} className="h-[400px]"></div>
            </div>
            <div className="text-[10px] text-muted">
              💡 Tip: Bạn có thể gõ các câu lệnh trực tiếp vào khung console phía trên để tương tác với tiến trình đang chạy.
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
      </div>
    </div>
  );
}
