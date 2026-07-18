import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Apps from './pages/Apps';
import AppDetail from './pages/AppDetail';
import FileManager from './pages/FileManager';
import Monitor from './pages/Monitor';
import Runtimes from './pages/Runtimes';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Nodes from './pages/Nodes';
import CreateNewApp from './pages/CreateNewApp';
import { getToken, getUser, removeToken } from './utils/api';
import { ShieldAlert } from 'lucide-react';

export default function App() {
  const [user, setUserState] = useState(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('orbiton_theme') || 'theme-cyberpunk');
  const [rateLimitNotice, setRateLimitNotice] = useState(null);

  useEffect(() => {
    const root = window.document.documentElement;
    // Remove all old theme classes
    root.className = '';
    // Apply new theme class
    root.classList.add(theme);
    localStorage.setItem('orbiton_theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleRateLimit = (e) => {
      setRateLimitNotice(e.detail);
    };
    window.addEventListener('api-rate-limited', handleRateLimit);
    return () => window.removeEventListener('api-rate-limited', handleRateLimit);
  }, []);

  // AppDetail state
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [initialDetailTab, setInitialDetailTab] = useState('logs');

  useEffect(() => {
    const token = getToken();
    const u = getUser();
    if (token && u) {
      setUserState(u);
    }
    setTokenChecked(true);
  }, []);

  // Pterodactyl-style URL Routing
  useEffect(() => {
    if (!user) return;

    const handleRouting = () => {
      const path = window.location.pathname;
      const m = path.match(/^\/server\/([^/]+)(?:\/(console|info|domains|backups|crons|settings|logs))?$/);
      if (m) {
        let [, appId, tab] = m;
        if (tab === 'logs') tab = 'console';
        setSelectedAppId(appId);
        setInitialDetailTab(tab || 'console');
        setActivePage('app-detail');
      } else if (path === '/dashboard') {
        setActivePage('dashboard');
      } else if (['/apps', '/files', '/monitor', '/runtimes', '/users', '/settings', '/create-new-app'].includes(path)) {
        setActivePage(path.substring(1));
      } else {
        setActivePage('dashboard');
      }
    };

    handleRouting();
    window.addEventListener('popstate', handleRouting);
    return () => window.removeEventListener('popstate', handleRouting);
  }, [user]);

  // Client Security Route Shield (Redirect non-admin away from forbidden routes)
  useEffect(() => {
    if (user && user.role !== 'admin') {
      const forbidden = ['nodes', 'users', 'monitor', 'runtimes'];
      if (forbidden.includes(activePage)) {
        setActivePage('dashboard');
      }
    }
  }, [activePage, user]);

  const handlePageChange = (pageId) => {
    setActivePage(pageId);
    history.pushState({ page: pageId }, '', `/${pageId}`);
  };

  const handleOpenAppDetail = (appId, tab = 'console') => {
    setSelectedAppId(appId);
    setInitialDetailTab(tab === 'logs' ? 'console' : tab);
    setActivePage('app-detail');
    history.pushState({ page: 'server', appId, tab: tab === 'logs' ? 'console' : tab }, '', `/server/${appId}/${tab === 'logs' ? 'console' : tab}`);
  };

  const handleBackToApps = () => {
    setActivePage('apps');
    history.pushState({ page: 'apps' }, '', '/apps');
  };

  const handleLogout = () => {
    removeToken();
    localStorage.removeItem('user');
    setUserState(null);
    window.location.href = '/';
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (!tokenChecked) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={(u) => setUserState(u)} />;
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar Navigation */}
      <Sidebar
        activePage={activePage}
        setActivePage={handlePageChange}
        user={user}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 pl-0 md:pl-64 flex flex-col min-h-screen">
        <Topbar
          activePage={activePage}
          onRefresh={handleRefresh}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          theme={theme}
          setTheme={setTheme}
        />

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto page-fade-in" key={activePage}>
          {activePage === 'dashboard' && (
            <Dashboard onOpenApp={handleOpenAppDetail} onRefreshTrigger={refreshTrigger} user={user} />
          )}
          {activePage === 'apps' && (
            <Apps onOpenApp={handleOpenAppDetail} onRefreshTrigger={refreshTrigger} user={user} setActivePage={handlePageChange} />
          )}
          {activePage === 'create-new-app' && (
            <CreateNewApp onBack={handleBackToApps} onRefresh={handleRefresh} />
          )}
          {activePage === 'app-detail' && selectedAppId && (
            <AppDetail
              appId={selectedAppId}
              initialTab={initialDetailTab}
              onBack={handleBackToApps}
              onRefreshTrigger={refreshTrigger}
              onTabChange={(tabId) => handleOpenAppDetail(selectedAppId, tabId)}
            />
          )}
          {activePage === 'files' && (
            <FileManager onRefreshTrigger={refreshTrigger} />
          )}
          {activePage === 'monitor' && (
            <Monitor onRefreshTrigger={refreshTrigger} />
          )}
          {activePage === 'runtimes' && (
            <Runtimes onRefreshTrigger={refreshTrigger} />
          )}
          {activePage === 'users' && (
            <Users currentUser={user} onRefreshTrigger={refreshTrigger} />
          )}
          {activePage === 'nodes' && (
            <Nodes onRefreshTrigger={refreshTrigger} />
          )}
          {activePage === 'settings' && (
            <Settings theme={theme} setTheme={setTheme} />
          )}
        </main>
      </div>

      {rateLimitNotice && (
        <RateLimitToast
          message={rateLimitNotice.message}
          retryAfter={rateLimitNotice.retryAfter}
          onClose={() => setRateLimitNotice(null)}
        />
      )}
    </div>
  );
}

// ─── Rate Limit Countdown Toast Component ─────────────────────
function RateLimitToast({ message, retryAfter, onClose }) {
  const [timeLeft, setTimeLeft] = useState(retryAfter);

  useEffect(() => {
    setTimeLeft(retryAfter);
  }, [retryAfter]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onClose();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full bg-red-500/10 backdrop-blur-md border border-red-500/35 p-4 rounded-2xl shadow-2xl flex gap-3 animate-pulse-once">
      <div className="w-10 h-10 rounded-xl bg-red-500/25 flex items-center justify-center text-red-500 shrink-0">
        <ShieldAlert className="w-5 h-5 animate-bounce" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-red-400">Security Guard Active</h4>
        <p className="text-xs text-text2 mt-1 leading-relaxed">{message}</p>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Spam lock:</span>
          <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
            {timeLeft}s remaining
          </span>
        </div>
      </div>
      <button onClick={onClose} className="text-muted hover:text-text align-top font-bold text-lg leading-none h-4">&times;</button>
    </div>
  );
}
