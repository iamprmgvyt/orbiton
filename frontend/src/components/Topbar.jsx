import React from 'react';
import { RefreshCw, Menu, Sun, Moon, Search } from 'lucide-react';
import LanguageSelector from './LanguageSelector';
import { useTranslation } from '../utils/i18n';

export default function Topbar({ activePage, onRefresh, onOpenSidebar, theme, setTheme, panelName = 'Orbiton', onOpenCommandPalette }) {
  const { t } = useTranslation();

  const TITLES = {
    dashboard: [t('nav.dashboard'), t('dashboard.welcome')],
    apps: [t('nav.apps'), t('apps.subtitle')],
    'app-detail': [t('console.hud_title'), 'Real-time terminal and process telemetry'],
    terminal: ['AIO Terminal', 'Direct terminal console to the host VPS'],
    files: ['File Manager', 'Browse, upload, and edit local files'],
    monitor: [t('nav.monitor'), 'Detailed graphical performance metrics'],
    runtimes: [t('nav.runtimes'), 'Installed compilers, runners and package managers'],
    users: [t('nav.users'), 'Configure access control and administrator roles'],
    nodes: [t('nav.nodes'), 'Configure external Daemon host nodes and secure Master Keys'],
    settings: [t('nav.settings'), t('settings.title')],
  };

  const [title, sub] = TITLES[activePage] || [panelName, 'Server Manager'];

  return (
    <header className="h-16 border-b border-border bg-bg/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Mobile Toggle & Titles */}
      <div className="flex items-center gap-4">
        <button onClick={onOpenSidebar} className="md:hidden p-2 rounded-xl border border-border text-text2 hover:bg-surface hover:text-text transition-all">
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-base font-bold text-text flex items-center gap-2">
            <span style={{ color: 'var(--accent)' }}>{panelName}</span>
            <span className="text-muted font-normal">/</span>
            {title}
            {sub && <span className="text-xs font-medium text-muted hidden sm:inline">| {sub}</span>}
          </h2>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="p-2 rounded-xl border border-border text-text2 hover:bg-surface hover:text-text transition-all flex items-center gap-2 text-xs"
          style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 12px' }}
        >
          <Search className="w-4 h-4 text-accent" />
          <span className="hidden md:inline text-muted">{t('brand.quick_search')}</span>
          <span className="hidden md:inline px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-text2 font-mono">Ctrl+K</span>
        </button>

        {/* Language Switcher Dropdown */}
        <LanguageSelector />

        {/* Theme Switcher */}
        <button
          onClick={() => setTheme(theme === 'theme-nordic' ? 'theme-cyberpunk' : 'theme-nordic')}
          className="p-2.5 rounded-xl border border-border text-text2 hover:bg-surface hover:text-text transition-colors flex items-center justify-center"
          title="Toggle Light/Dark Theme"
        >
          {theme === 'theme-nordic' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="p-2.5 rounded-xl border border-border text-text2 hover:bg-surface hover:text-text transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">{t('common.refresh')}</span>
        </button>
      </div>
    </header>
  );
}
