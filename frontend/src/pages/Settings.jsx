import React, { useState, useEffect } from 'react';
import { api, removeToken } from '../utils/api';
import { 
  Key, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Globe, 
  RefreshCw, 
  Palette, 
  Check,
  ClipboardList 
} from 'lucide-react';

export default function Settings({ theme, setTheme }) {
  const [activeTab, setActiveTab] = useState('password');
  
  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Firewall states
  const [fwActive, setFwActive] = useState(false);
  const [fwRules, setFwRules] = useState([]);
  const [fwLoading, setFwLoading] = useState(true);
  const [newPort, setNewPort] = useState('');
  const [newProtocol, setNewProtocol] = useState('tcp');
  const [fwActionLoading, setFwActionLoading] = useState(false);

  // Audit Logs states
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';

  // Available Themes definition
  const THEMES = [
    { id: 'theme-cyberpunk', name: 'Cyberpunk Neon', bg: '#060612', accent: '#7c3aed', text: '#f1f5f9', desc: 'Default Dark Mode with purple/blue glowing accents.' },
    { id: 'theme-ocean', name: 'Deep Ocean', bg: '#030a16', accent: '#0d9488', text: '#e2e8f0', desc: 'Sleek dark theme with oceanic teal & cyan tones.' },
    { id: 'theme-emerald', name: 'Forest Emerald', bg: '#02140e', accent: '#10b981', text: '#e6f4ea', desc: 'Calming dark green palette styled with emerald hints.' },
    { id: 'theme-sakura', name: 'Sakura Dream', bg: '#150d12', accent: '#ec4899', text: '#faeaf1', desc: 'Premium dark-plum theme styled with sakura blossom pinks.' },
    { id: 'theme-nordic', name: 'Nordic Light', bg: '#f8fafc', accent: '#6d28d9', text: '#0f172a', desc: 'Modern and clean Light Mode with slate contrast.' },
  ];

  const loadFirewall = async () => {
    if (!isAdmin) return;
    setFwLoading(true);
    try {
      const data = await api('/system/firewall');
      setFwActive(data.active);
      setFwRules(data.rules || []);
    } catch (err) {
      console.error(err);
    } finally {
      setFwLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    if (!isAdmin) return;
    setAuditLoading(true);
    try {
      const data = await api('/system/audit-logs');
      setAuditLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'firewall') loadFirewall();
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    setPasswordLoading(true);
    try {
      await api('/auth/change-password', 'POST', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('Password changed successfully! Please log in again.');
      removeToken();
      localStorage.removeItem('user');
      window.location.reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleOpenPort = async (e) => {
    e.preventDefault();
    const portNum = parseInt(newPort);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      alert('Please enter a valid port number (1-65535)');
      return;
    }
    setFwActionLoading(true);
    try {
      await api('/system/firewall/open', 'POST', { port: portNum, protocol: newProtocol });
      setNewPort('');
      loadFirewall();
    } catch (err) {
      alert(err.message);
    } finally {
      setFwActionLoading(false);
    }
  };

  const handleClosePort = async (port, protocol) => {
    if (!confirm(`Are you sure you want to close port ${port}/${protocol}?`)) return;
    setFwActionLoading(true);
    try {
      await api('/system/firewall/close', 'POST', { port, protocol });
      loadFirewall();
    } catch (err) {
      alert(err.message);
    } finally {
      setFwActionLoading(false);
    }
  };

  const getActionColor = (action) => {
    const act = action.toLowerCase();
    if (act.includes('start')) return 'bg-green-500/10 border-green-500/20 text-green-400';
    if (act.includes('stop') || act.includes('kill')) return 'bg-red-500/10 border-red-500/20 text-red-400';
    if (act.includes('create') || act.includes('deploy')) return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
    if (act.includes('delete')) return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
    return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
  };

  return (
    <div className="space-y-6">
      {/* Navigation tabs */}
      <div className="flex border-b border-border gap-2 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('password')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'password'
              ? 'border-accent text-accent bg-accent/5'
              : 'border-transparent text-muted hover:text-text'
          }`}
        >
          <Key className="w-4 h-4" />
          Password Settings
        </button>
        <button
          onClick={() => setActiveTab('theme')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'theme'
              ? 'border-accent text-accent bg-accent/5'
              : 'border-transparent text-muted hover:text-text'
          }`}
        >
          <Palette className="w-4 h-4" />
          Appearance & Themes
        </button>
        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('firewall')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'firewall'
                  ? 'border-accent text-accent bg-accent/5'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              <Globe className="w-4 h-4" />
              Node Firewall (UFW)
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'audit'
                  ? 'border-accent text-accent bg-accent/5'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Activity Logs
            </button>
          </>
        )}
      </div>

      {/* Password Form */}
      {activeTab === 'password' && (
        <div className="max-w-md bg-surface border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <h3 className="font-bold text-text mb-2">Change Account Password</h3>
          <p className="text-xs text-muted mb-6">Secures access control credentials. You will need to log back in after updates.</p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="bg-accent hover:bg-accent/90 active:scale-95 text-white font-semibold text-sm px-5 py-3 rounded-xl shadow-lg shadow-accent/15 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Key className="w-4 h-4" />
              Update Password
            </button>
          </form>
        </div>
      )}

      {/* Theme Customizer Tab */}
      {activeTab === 'theme' && (
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="font-bold text-text">Choose Color Theme Palette</h3>
            <p className="text-xs text-muted mt-1">Select your preferred Orbiton styling color profile. Theme applies instantly to all components.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {THEMES.map((t) => {
              const isSelected = theme === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`border rounded-2xl p-5 cursor-pointer transition-all flex items-start justify-between gap-4 hover:border-accent ${
                    isSelected ? 'border-accent bg-accent/5' : 'border-border bg-bg2/40'
                  }`}
                >
                  <div className="space-y-2">
                    <span className="block text-sm font-bold text-text">{t.name}</span>
                    <span className="block text-xs text-muted">{t.desc}</span>
                  </div>

                  {/* Palette Preview Dots */}
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full border border-white/20" 
                      style={{ backgroundColor: t.bg }} 
                      title="Background"
                    />
                    <div 
                      className="w-4 h-4 rounded-full border border-white/20" 
                      style={{ backgroundColor: t.accent }} 
                      title="Accent"
                    />
                    <div 
                      className="w-4 h-4 rounded-full border border-white/20" 
                      style={{ backgroundColor: t.text }} 
                      title="Text"
                    />
                    {isSelected && (
                      <div className="bg-accent text-white p-1 rounded-full ml-1">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Firewall tab */}
      {activeTab === 'firewall' && isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Form and info */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-text">Open Node Port</h3>
                <button
                  onClick={loadFirewall}
                  className="p-2 hover:bg-surface2 rounded-xl text-muted hover:text-text transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted mb-6">Open an inbound UFW port directly on your Node VPS to allow public connections (e.g., game server, web server, API).</p>

              <form onSubmit={handleOpenPort} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Port Number</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="65535"
                    value={newPort}
                    onChange={e => setNewPort(e.target.value)}
                    placeholder="e.g. 25565"
                    className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Protocol</label>
                  <select
                    value={newProtocol}
                    onChange={e => setNewProtocol(e.target.value)}
                    className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                  >
                    <option value="tcp">TCP (Web, Minecraft, databases)</option>
                    <option value="udp">UDP (Voice servers, some game servers)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={fwActionLoading}
                  className="w-full bg-accent hover:bg-accent/90 active:scale-95 text-white font-semibold text-sm px-5 py-3 rounded-xl shadow-lg shadow-accent/15 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Open Port
                </button>
              </form>
            </div>
            
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden flex items-start gap-4">
              <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-xl border border-yellow-500/20">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-text">Firewall Security</h4>
                <p className="text-xs text-muted mt-1 leading-relaxed">Only open ports that are strictly necessary. Avoid opening database ports (like 3306, 5432, 27017) to the public without secure authorization layers.</p>
              </div>
            </div>
          </div>

          {/* Rules List */}
          <div className="md:col-span-2 bg-surface border border-border rounded-2xl p-6 shadow-xl">
            <h3 className="font-bold text-text mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-accent" />
              Active UFW Port Rules
            </h3>
            {fwLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
              </div>
            ) : !fwActive ? (
              <div className="text-center py-20 border border-dashed border-border rounded-xl">
                <span className="text-4xl block mb-2">🛡️</span>
                <h4 className="font-bold text-text">UFW Firewall is Inactive</h4>
                <p className="text-xs text-muted mt-1 max-w-xs mx-auto">The UFW service is currently disabled on this VPS. All inbound ports are open by default.</p>
              </div>
            ) : !fwRules.length ? (
              <div className="text-center py-20 border border-dashed border-border rounded-xl">
                <span className="text-4xl block mb-2">🌐</span>
                <h4 className="font-bold text-text">No custom rules</h4>
                <p className="text-xs text-muted mt-1 max-w-xs mx-auto">No inbound ports have been opened via UFW custom rules. Only system default ports are accessible.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border text-muted text-[10px] uppercase font-bold tracking-wider">
                      <th className="pb-3">Port / Protocol</th>
                      <th className="pb-3">Action</th>
                      <th className="pb-3">Direction</th>
                      <th className="pb-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {fwRules.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-surface2/50 transition-colors">
                        <td className="py-4 font-mono font-semibold text-text">
                          <span className="text-accent">{rule.port}</span>
                          <span className="text-muted">/{rule.protocol}</span>
                        </td>
                        <td className="py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-500/10 border border-green-500/20 text-green-400">
                            {rule.action}
                          </span>
                        </td>
                        <td className="py-4 text-xs text-muted">INBOUND</td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => handleClosePort(rule.port, rule.protocol)}
                            disabled={fwActionLoading}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/10 text-red-500 rounded-xl transition-all disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Logs tab */}
      {activeTab === 'audit' && isAdmin && (
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-text">Global Activity Logs</h3>
              <p className="text-xs text-muted mt-1">Audit log tracking administrative actions and API access events on this Node host.</p>
            </div>
            <button
              onClick={loadAuditLogs}
              className="p-2 hover:bg-surface2 rounded-xl text-muted hover:text-text transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {auditLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-xl">
              <span className="text-4xl block mb-2">📋</span>
              <h4 className="font-bold text-text">No logs found</h4>
              <p className="text-xs text-muted mt-1 max-w-xs mx-auto">No administrative events have been recorded in the database yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted text-[10px] uppercase font-bold tracking-wider">
                    <th className="pb-3">Time</th>
                    <th className="pb-3">User</th>
                    <th className="pb-3">Action</th>
                    <th className="pb-3">Target Application</th>
                    <th className="pb-3 text-right">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface2/30 transition-colors">
                      <td className="py-4 text-xs font-semibold text-text2 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-4 text-xs font-bold text-text">
                        {log.username || 'System'}
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-4 text-xs text-muted font-mono">
                        {log.target || 'N/A'}
                      </td>
                      <td className="py-4 text-xs text-muted font-mono text-right">
                        {log.ip || '127.0.0.1'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
