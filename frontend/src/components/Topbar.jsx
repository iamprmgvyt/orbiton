import React from 'react';
import { RefreshCw, Menu } from 'lucide-react';

export default function Topbar({ activePage, onRefresh, onOpenSidebar }) {
  const TITLES = {
    dashboard: ['Dashboard', 'System overview and core statistics'],
    apps: ['Applications', 'Manage all your self-hosted services'],
    'app-detail': ['Server Console', 'Real-time terminal and process telemetry'],
    terminal: ['AIO Terminal', 'Direct terminal console to the host VPS'],
    files: ['File Manager', 'Browse, upload, and edit local files'],
    monitor: ['System Monitor', 'Detailed graphical performance metrics'],
    runtimes: ['Runtime', 'Installed compilers, runners and package managers'],
    users: ['Users Management', 'Configure access control and administrator roles'],
    nodes: ['Nodes Management', 'Configure external Daemon host nodes and secure Master Keys'],
    settings: ['Settings', 'Customize security and profile settings'],
  };

  const [title, sub] = TITLES[activePage] || ['System Panel', 'Orbiton Manager'];

  return (
    <header className="h-16 border-b border-border bg-bg/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Mobile Toggle & Titles */}
      <div className="flex items-center gap-4">
        <button onClick={onOpenSidebar} className="md:hidden p-2 rounded-xl border border-border text-text2 hover:bg-surface hover:text-text transition-all">
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-base font-bold text-text flex items-center gap-2">
            {title}
            {sub && <span className="text-xs font-medium text-muted hidden sm:inline">| {sub}</span>}
          </h2>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          className="p-2.5 rounded-xl border border-border text-text2 hover:bg-surface hover:text-text transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
}
