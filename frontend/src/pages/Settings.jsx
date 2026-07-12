import React, { useState } from 'react';
import { api, removeToken } from '../utils/api';
import { Key, ShieldAlert } from 'lucide-react';

export default function Settings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    setLoading(true);
    setSuccess(false);
    try {
      await api('/auth/change-password', 'POST', { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('Password changed successfully! Please log in again.');
      // logout
      removeToken();
      localStorage.removeItem('user');
      window.location.reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="max-w-md bg-surface border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <h3 className="font-bold text-text mb-2">Change Account Password</h3>
        <p className="text-xs text-muted mb-6">Secures access control credentials. You will need to log back in after updates.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            disabled={loading}
            className="bg-accent hover:bg-accent/90 active:scale-95 text-white font-semibold text-sm px-5 py-3 rounded-xl shadow-lg shadow-accent/15 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Key className="w-4 h-4" />
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}
