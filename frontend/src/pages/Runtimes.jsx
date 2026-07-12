import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { CheckCircle, XCircle, Cpu } from 'lucide-react';

export default function Runtimes({ onRefreshTrigger }) {
  const [runtimes, setRuntimes] = useState({});
  const [loading, setLoading] = useState(true);

  const loadRuntimes = async () => {
    setLoading(true);
    try {
      const data = await api('/system/runtimes');
      setRuntimes(data || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuntimes();
  }, [onRefreshTrigger]);

  const icons = {
    nodejs: '🟩', npm: '📦', python3: '🐍', pip3: '📦', java: '☕',
    docker: '🐳', git: '🔀', curl: '🌐', wget: '⬇️', gradle: '🏗️',
    mvn: '🏗️', go: '🔵', rust: '🦀', deno: '🦕', bun: '🥟',
    php: '🐘', ruby: '💎', perl: '🐪', lua: '🌙', bash: '🔧'
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
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
        <h3 className="font-bold text-text mb-2">Installed Runtime Compilers & Package Tools</h3>
        <p className="text-xs text-muted">Auto-detected environments installed on the server hosting daemon.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(runtimes).map(([key, r]) => (
          <div
            key={key}
            className={`border rounded-2xl p-4 flex items-center gap-4 transition-all ${
              r.installed
                ? 'bg-green-500/5 border-green-500/10 hover:border-green-500/30'
                : 'bg-surface border-border hover:border-border2'
            }`}
          >
            <span className="text-3xl">{icons[key] || '⚙️'}</span>
            <div className="overflow-hidden">
              <span className="block font-bold text-sm text-text truncate">{r.name}</span>
              <span className={`block text-[10px] mt-0.5 truncate font-semibold ${r.installed ? 'text-green-400' : 'text-muted'}`}>
                {r.installed ? r.version : 'Not installed'}
              </span>
            </div>
            <div className="ml-auto">
              {r.installed ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-muted/40" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
