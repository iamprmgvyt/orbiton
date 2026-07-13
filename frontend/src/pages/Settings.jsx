import React, { useState, useEffect } from 'react';
import { api, removeToken } from '../utils/api';
import { Key, ShieldAlert, Plus, Trash2, Globe, RefreshCw } from 'lucide-react';

export default function Settings() {
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

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';

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

  useEffect(() => {
    if (activeTab === 'firewall') {
      loadFirewall();
    }
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
        {isAdmin && (
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
              <p className="text-xs text-muted mb-6">Mở cổng tường lửa UFW trực tiếp trên Node VPS của bạn để cho phép kết nối bên ngoài (ví dụ: server game, web server, API).</p>

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
                <h4 className="font-bold text-sm text-text">Bảo mật Tường lửa</h4>
                <p className="text-xs text-muted mt-1 leading-relaxed">Chỉ mở những cổng thực sự cần thiết cho hoạt động của ứng dụng. Tránh mở công khai các cổng CSDL (như 3306, 5432, 27017) nếu không có cơ chế xác thực an toàn.</p>
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
                <p className="text-xs text-muted mt-1 max-w-xs mx-auto">Tường lửa UFW hiện đang tắt trên VPS này. Mọi cổng mạng đều mở mặc định và có thể kết nối tự do từ bên ngoài.</p>
              </div>
            ) : !fwRules.length ? (
              <div className="text-center py-20 border border-dashed border-border rounded-xl">
                <span className="text-4xl block mb-2">🌐</span>
                <h4 className="font-bold text-text">No custom rules</h4>
                <p className="text-xs text-muted mt-1 max-w-xs mx-auto">Chưa có cổng tùy chỉnh nào được mở bằng UFW. Chỉ các cổng hệ thống mặc định được phép kết nối.</p>
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
    </div>
  );
}
