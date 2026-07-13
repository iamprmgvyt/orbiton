import React, { useEffect, useState, useRef } from 'react';
import { api } from '../utils/api';
import { CheckCircle, XCircle, Terminal, Download, Loader2, RefreshCw } from 'lucide-react';

export default function Runtimes({ onRefreshTrigger }) {
  const [runtimes, setRuntimes] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeLogRuntime, setActiveLogRuntime] = useState(null);
  const [installLog, setInstallLog] = useState('');
  const logEndRef = useRef(null);

  const loadRuntimes = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api('/system/runtimes');
      setRuntimes(data || {});
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Poll runtimes list if there is any runtime actively installing
  useEffect(() => {
    loadRuntimes();
  }, [onRefreshTrigger]);

  useEffect(() => {
    const isAnyInstalling = Object.values(runtimes).some(r => r.isInstalling);
    if (!isAnyInstalling) return;

    const timer = setInterval(() => {
      loadRuntimes(false);
    }, 3500);

    return () => clearInterval(timer);
  }, [runtimes]);

  // Load and refresh log of current installing runtime
  useEffect(() => {
    if (!activeLogRuntime) return;

    const fetchLog = async () => {
      try {
        const res = await api(`/system/runtimes/install/log?runtime=${activeLogRuntime}`);
        setInstallLog(res.log || 'No logs available yet...');
        setTimeout(() => {
          logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } catch (_) {}
    };

    fetchLog();
    const interval = setInterval(fetchLog, 2500);
    return () => clearInterval(interval);
  }, [activeLogRuntime]);

  const handleInstall = async (runtime) => {
    try {
      await api('/system/runtimes/install', 'POST', { runtime });
      loadRuntimes(false);
      // Auto open log viewer for user
      setActiveLogRuntime(runtime);
    } catch (err) {
      alert(err.message);
    }
  };

  const getIcon = (key) => {
    const urls = {
      nodejs: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
      npm: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/npm/npm-original-wordmark.svg',
      python3: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
      pip3: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
      java: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg',
      docker: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg',
      git: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg',
      curl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linux/linux-original.svg',
      wget: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linux/linux-original.svg',
      gradle: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/gradle/gradle-original.svg',
      mvn: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/maven/maven-original.svg',
      go: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original.svg',
      rust: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-original.svg',
      deno: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/denojs/denojs-original.svg',
      bun: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/bun/bun-original.svg',
      php: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/php/php-original.svg',
      ruby: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/ruby/ruby-original.svg',
      perl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/perl/perl-original.svg',
      lua: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/lua/lua-original.svg',
      bash: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/bash/bash-original.svg'
    };

    const src = urls[key] || 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/codepen/codepen-plain.svg';
    return <img src={src} alt={key} className="w-6 h-6 object-contain" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-text mb-2 text-lg">🪐 Orbiton Runtime Shop & Compiler Detector</h3>
          <p className="text-xs text-muted">Auto-detect system runtimes or seamlessly install compilers direct to host VPS node.</p>
        </div>
        <button
          onClick={() => loadRuntimes(true)}
          className="p-2.5 rounded-xl border border-border text-text2 hover:bg-surface hover:text-text transition-all self-start sm:self-center flex items-center gap-2 text-sm font-semibold"
        >
          <RefreshCw className="w-4 h-4" />
          Scan Host System
        </button>
      </div>

      {/* Runtimes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Object.entries(runtimes).map(([key, r]) => {
          const showInstallButton = !r.installed && !r.isInstalling;
          return (
            <div
              key={key}
              className={`border rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all shadow-md ${
                r.installed
                  ? 'bg-green-500/[0.02] border-green-500/10 hover:border-green-500/20'
                  : r.isInstalling
                  ? 'bg-yellow-500/[0.02] border-yellow-500/20 hover:border-yellow-500/30'
                  : 'bg-surface border-border hover:border-border2'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-surface2 border border-border flex items-center justify-center flex-shrink-0">
                  {getIcon(key)}
                </div>
                <div className="overflow-hidden flex-1">
                  <span className="block font-bold text-sm text-text truncate">{r.name}</span>
                  <span className={`block text-[10px] mt-0.5 truncate font-semibold uppercase tracking-wider ${
                    r.installed 
                      ? 'text-green-400' 
                      : r.isInstalling 
                      ? 'text-yellow-400' 
                      : 'text-muted'
                  }`}>
                    {r.installed ? r.version : r.isInstalling ? 'Installing...' : 'Not installed'}
                  </span>
                </div>
                <div className="flex-shrink-0">
                  {r.installed ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : r.isInstalling ? (
                    <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                  ) : (
                    <XCircle className="w-5 h-5 text-muted/30" />
                  )}
                </div>
              </div>

              {/* Action Buttons for Shop Installer */}
              {(showInstallButton || r.isInstalling) && (
                <div className="flex items-center gap-2 border-t border-border/50 pt-3 mt-1">
                  {showInstallButton ? (
                    <button
                      onClick={() => handleInstall(key)}
                      className="w-full bg-accent hover:bg-accent/90 active:scale-98 text-white font-semibold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-accent/15"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Install Compiler
                    </button>
                  ) : (
                    <>
                      <div className="flex-1 bg-yellow-500/10 text-yellow-500 font-bold text-[10px] uppercase py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Running setup...
                      </div>
                      <button
                        onClick={() => setActiveLogRuntime(key)}
                        className="bg-surface hover:bg-surface2 border border-border text-text2 hover:text-text font-bold text-xs py-2 px-3 rounded-xl transition-colors flex items-center gap-1"
                        title="View Setup Logs"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        Log
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Realtime Installation Logs Modal */}
      {activeLogRuntime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-bg2 border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-bg">
              <div>
                <h3 className="font-bold text-text flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-accent" />
                  Setup Log: {runtimes[activeLogRuntime]?.name || activeLogRuntime}
                </h3>
                <p className="text-[10px] text-muted mt-0.5">Realtime compiler installation task logs</p>
              </div>
              <button
                onClick={() => {
                  setActiveLogRuntime(null);
                  setInstallLog('');
                }}
                className="text-muted hover:text-text font-bold text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Terminal Console View */}
            <div className="flex-1 p-4 bg-[#030307] overflow-y-auto font-mono text-xs text-green-400 space-y-1.5 min-h-[300px]">
              {installLog.split('\n').map((line, i) => (
                <div key={i} className="whitespace-pre-wrap leading-relaxed">{line}</div>
              ))}
              <div ref={logEndRef} />
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-bg flex justify-between items-center">
              <span className="text-[10px] text-muted">Updates every 2.5s automatically</span>
              <button
                onClick={() => {
                  setActiveLogRuntime(null);
                  setInstallLog('');
                }}
                className="px-4 py-2 bg-surface hover:bg-surface2 border border-border rounded-xl text-xs font-semibold text-text"
              >
                Close Logs Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
