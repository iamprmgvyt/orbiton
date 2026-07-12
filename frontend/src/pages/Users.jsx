import React, { useEffect, useState } from 'react';
import { api, fmtDate } from '../utils/api';
import { UserPlus, Trash2, Key, Shield } from 'lucide-react';

export default function Users({ currentUser, onRefreshTrigger }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api('/auth/users');
      setUsers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [onRefreshTrigger]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api('/auth/users', 'POST', { username, password, role });
      setIsModalOpen(false);
      setUsername('');
      setPassword('');
      setRole('user');
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (id === currentUser.id) {
      alert("You cannot delete your own account!");
      return;
    }
    if (!confirm(`Delete user "${name}"?`)) return;
    try {
      await api(`/auth/users/${id}`, 'DELETE');
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">Manage administrator and client access keys</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-accent hover:bg-accent/90 active:scale-95 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-accent/20 transition-all flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Create User Access
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-border bg-bg2/40">
          <h3 className="font-bold text-text">Access Users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-xs font-bold text-muted uppercase tracking-wider bg-bg2/20">
                <th className="px-6 py-3.5">ID</th>
                <th className="px-6 py-3.5">Username</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Created At</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface/30">
                  <td className="px-6 py-4 font-mono text-muted">{u.id}</td>
                  <td className="px-6 py-4 font-bold text-text">{u.username}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      u.role === 'admin'
                        ? 'bg-accent/15 text-accent border border-accent/20'
                        : 'bg-surface2 text-text2 border border-border'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text2">{fmtDate(u.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    {u.id !== currentUser.id ? (
                      <button
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-xs text-muted font-medium pr-2">You</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-bg2 border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-bg">
              <h3 className="font-bold text-text">Create Access User</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-text font-bold text-xl">×</button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="john_doe"
                  className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Role Permissions</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                >
                  <option value="user">User (Apps and File manager only)</option>
                  <option value="admin">Administrator (Full control)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 border border-border rounded-xl text-sm font-semibold hover:bg-surface text-text2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-sm font-semibold shadow-lg shadow-accent/15"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
