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
import { getToken, getUser, removeToken } from './utils/api';

export default function App() {
  const [user, setUserState] = useState(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('orbiton_theme') || 'dark');

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('orbiton_theme', theme);
  }, [theme]);

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
      const m = path.match(/^\/server\/([^/]+)(?:\/(console|files|logs|info))?$/);
      if (m) {
        const [, appId, tab] = m;
        setSelectedAppId(appId);
        setInitialDetailTab(tab || 'logs');
        setActivePage('app-detail');
      } else if (path === '/dashboard') {
        setActivePage('dashboard');
      } else if (['/apps', '/files', '/monitor', '/runtimes', '/users', '/settings'].includes(path)) {
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

  const handleOpenAppDetail = (appId, tab = 'logs') => {
    setSelectedAppId(appId);
    setInitialDetailTab(tab);
    setActivePage('app-detail');
    history.pushState({ page: 'server', appId, tab }, '', `/server/${appId}/${tab}`);
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
            <Apps onOpenApp={handleOpenAppDetail} onRefreshTrigger={refreshTrigger} user={user} />
          )}
          {activePage === 'app-detail' && selectedAppId && (
            <AppDetail
              appId={selectedAppId}
              initialTab={initialDetailTab}
              onBack={handleBackToApps}
              onRefreshTrigger={refreshTrigger}
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
            <Settings />
          )}
        </main>
      </div>
    </div>
  );
}
