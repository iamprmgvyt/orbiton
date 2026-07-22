import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../utils/i18n';
import { Search, Terminal, Cpu, Users, Settings, Activity, Play, Square, RotateCw, Globe, Palette } from 'lucide-react';

export default function CommandPalette({ isOpen, onClose, apps = [], onNavigate, onPowerAction }) {
  const { t, setLanguage } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Build command list dynamically
  const baseCommands = [
    { id: 'nav-dashboard', title: t('nav.dashboard'), type: 'nav', path: '/', icon: <Activity size={16} /> },
    { id: 'nav-apps', title: t('nav.apps'), type: 'nav', path: '/apps', icon: <Terminal size={16} /> },
    { id: 'nav-nodes', title: t('nav.nodes'), type: 'nav', path: '/nodes', icon: <Cpu size={16} /> },
    { id: 'nav-users', title: t('nav.users'), type: 'nav', path: '/users', icon: <Users size={16} /> },
    { id: 'nav-settings', title: t('nav.settings'), type: 'nav', path: '/settings', icon: <Settings size={16} /> },
    
    // Languages
    { id: 'lang-vi', title: 'Ngôn ngữ: Tiếng Việt 🇻🇳', type: 'lang', lang: 'vi', icon: <Globe size={16} /> },
    { id: 'lang-en', title: 'Language: English 🇬🇧', type: 'lang', lang: 'en', icon: <Globe size={16} /> },
    { id: 'lang-es', title: 'Idioma: Español 🇪🇸', type: 'lang', lang: 'es', icon: <Globe size={16} /> },
  ];

  // Map Apps into commands
  const appCommands = apps.map(app => ({
    id: `app-${app.id}`,
    title: `App: ${app.name} (${app.runtime || 'custom'})`,
    type: 'app',
    appId: app.id,
    status: app.status,
    icon: <Terminal size={16} style={{ color: app.status === 'running' ? '#10b981' : '#ef4444' }} />
  }));

  const allItems = [...baseCommands, ...appCommands];
  const filtered = allItems.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        executeItem(filtered[selectedIndex]);
      }
    }
  };

  const executeItem = (item) => {
    if (item.type === 'nav') {
      onNavigate(item.path);
    } else if (item.type === 'lang') {
      setLanguage(item.lang);
    } else if (item.type === 'app') {
      onNavigate(`/apps/${item.appId}`);
    }
    onClose();
  };

  return (
    <div 
      className="command-palette-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '80px'
      }}
    >
      <div 
        className="command-palette-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '580px',
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(59, 130, 246, 0.2)',
          overflow: 'hidden'
        }}
      >
        {/* Search Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Search size={18} style={{ color: 'var(--text-muted)', marginRight: '12px' }} />
          <input 
            ref={inputRef}
            type="text"
            placeholder={t('brand.quick_search') + '...'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '15px'
            }}
          />
          <span style={{ fontSize: '11px', background: 'rgba(255, 255, 255, 0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
            ESC
          </span>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '8px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px', textCenter: 'center', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
              No matching commands or apps found.
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div 
                key={item.id}
                onClick={() => executeItem(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: idx === selectedIndex ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: idx === selectedIndex ? '#38bdf8' : '#e2e8f0',
                  transition: 'background 0.1s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {item.icon}
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{item.title}</span>
                </div>
                {item.type === 'app' && (
                  <span style={{ 
                    fontSize: '11px', 
                    padding: '2px 8px', 
                    borderRadius: '10px',
                    background: item.status === 'running' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: item.status === 'running' ? '#34d399' : '#f87171'
                  }}>
                    {item.status}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
