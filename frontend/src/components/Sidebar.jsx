import React from 'react';
import {
  LayoutDashboard,
  Server,
  FolderOpen,
  Activity,
  Cpu,
  Users,
  Settings,
  LogOut,
  Shield,
  X,
  HardDrive
} from 'lucide-react';
import { useTranslation } from '../utils/i18n';

export default function Sidebar({ activePage, setActivePage, user, onLogout, isOpen, onClose, panelName = 'Orbiton' }) {
  const { t } = useTranslation();

  const menuItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'apps', label: t('nav.apps'), icon: Server },
    { id: 'files', label: 'File Manager', icon: FolderOpen },
    { id: 'monitor', label: t('nav.monitor'), icon: Activity },
    { id: 'runtimes', label: t('nav.runtimes'), icon: Cpu },
  ];

  if (user && user.role === 'admin') {
    menuItems.push({ id: 'nodes', label: t('nav.nodes'), icon: HardDrive });
    menuItems.push({ id: 'users', label: t('nav.users'), icon: Users });
  }

  menuItems.push({ id: 'settings', label: t('nav.settings'), icon: Settings });

  return (
    <>
      {/* Backdrop overlay for mobile screen sizes */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-all duration-300"
        ></div>
      )}

      <aside className={`w-64 border-r border-border bg-bg2 flex flex-col fixed inset-y-0 z-40 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        {/* Brand Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-accent to-accent3 flex items-center justify-center shadow-lg shadow-accent/20">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold tracking-wide text-text">{panelName}</span>
              <span className="text-[9px] block text-muted uppercase font-semibold leading-none mt-1">{t('brand.tagline')}</span>
            </div>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-xl border border-border/80 text-muted hover:text-text hover:bg-surface transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav Menu */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id || (item.id === 'apps' && activePage === 'app-detail');
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActivePage(item.id);
                  if (onClose) onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-accent text-white shadow-lg shadow-accent/15'
                    : 'text-text2 hover:bg-surface hover:text-text'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-muted'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer Profile */}
        <div className="p-4 border-t border-border bg-bg flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center font-bold text-accent text-sm uppercase">
              {user?.username ? user.username.slice(0, 2) : 'US'}
            </div>
            <div className="overflow-hidden">
              <span className="block text-sm font-semibold text-text truncate">{user?.username || 'User'}</span>
              <span className="block text-[10px] text-muted capitalize leading-none mt-1">{user?.role || 'Guest'}</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            title={t('brand.logout')}
            className="p-2 rounded-xl text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>
    </>
  );
}
