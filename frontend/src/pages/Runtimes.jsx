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
            <div className="w-11 h-11 rounded-xl bg-surface2 border border-border flex items-center justify-center flex-shrink-0">
              {getIcon(key)}
            </div>
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
