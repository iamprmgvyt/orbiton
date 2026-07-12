import React, { useEffect, useState } from 'react';
import { api, fmtBytes } from '../utils/api';
import { Play, Square, RotateCw, Terminal, Edit3, Trash2, Cpu, HardDrive } from 'lucide-react';

export default function Dashboard({ onOpenApp, onRefreshTrigger }) {
  const [stats, setStats] = useState(null);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [statsData, appsData] = await Promise.all([
        api('/system/stats'),
        api('/apps')
      ]);
      setStats(statsData);
      setApps(appsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [onRefreshTrigger]);

  const handleAction = async (e, appId, action) => {
    e.stopPropagation();
    try {
      await api(`/apps/${appId}/${action}`, 'POST');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (e, appId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this app?')) return;
    try {
      await api(`/apps/${appId}`, 'DELETE');
      loadData();
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

  const runningApps = apps.filter(a => a.liveStatus === 'running').length;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* CPU */}
        <div className="bg-surface border border-border rounded-2xl p-6 transition-all hover:border-border2">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">CPU Usage</span>
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
              <Cpu className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-text">{stats?.cpu?.usage}%</div>
          <p className="text-[10px] text-muted truncate mt-1">{stats?.cpu?.model || 'Detecting...'}</p>
          <div className="w-full bg-border rounded-full h-1.5 mt-4 overflow-hidden">
            <div className="bg-yellow-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${stats?.cpu?.usage || 0}%` }}></div>
          </div>
        </div>

        {/* RAM */}
        <div className="bg-surface border border-border rounded-2xl p-6 transition-all hover:border-border2">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">RAM Usage</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Cpu className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-text">{stats?.memory?.usedPercent}%</div>
          <p className="text-[10px] text-muted truncate mt-1">
            {stats?.memory ? `${fmtBytes(stats.memory.used)} / ${fmtBytes(stats.memory.total)}` : 'Detecting...'}
          </p>
          <div className="w-full bg-border rounded-full h-1.5 mt-4 overflow-hidden">
            <div className="bg-purple-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${stats?.memory?.usedPercent || 0}%` }}></div>
          </div>
        </div>

        {/* Disk */}
        <div className="bg-surface border border-border rounded-2xl p-6 transition-all hover:border-border2">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Disk space</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <HardDrive className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-text">{stats?.disk?.[0]?.usedPercent}%</div>
          <p className="text-[10px] text-muted truncate mt-1">
            {stats?.disk?.[0] ? `${fmtBytes(stats.disk[0].used)} / ${fmtBytes(stats.disk[0].size)}` : 'Detecting...'}
          </p>
          <div className="w-full bg-border rounded-full h-1.5 mt-4 overflow-hidden">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${stats?.disk?.[0]?.usedPercent || 0}%` }}></div>
          </div>
        </div>

        {/* Running Apps */}
        <div className="bg-surface border border-border rounded-2xl p-6 transition-all hover:border-border2">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Running Apps</span>
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
              <span className="text-sm font-bold">🚀</span>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-text">{runningApps}</div>
          <p className="text-[10px] text-muted mt-1">of {apps.length} total applications</p>
        </div>
      </div>

      {/* Apps Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-bg2/40">
          <h3 className="font-bold text-text">Server Applications</h3>
          <span className="text-xs px-2.5 py-1 rounded-full bg-border text-text2 font-semibold">{apps.length} Total</span>
        </div>

        {!apps.length ? (
          <div className="p-12 text-center text-muted">
            <p className="text-lg font-semibold">No applications installed</p>
            <p className="text-xs mt-1">Head to the "Applications" page to create or import your first app.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-bold text-muted uppercase tracking-wider bg-bg2/20">
                  <th className="px-6 py-3.5">Name</th>
                  <th className="px-6 py-3.5">Runtime</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Command</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {apps.map((app) => {
                  const isRunning = app.liveStatus === 'running' || app.liveStatus === 'starting';
                  return (
                    <tr
                      key={app.id}
                      onClick={() => onOpenApp(app.id)}
                      className="hover:bg-surface/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-4.5 font-semibold text-text group-hover:text-accent transition-colors">
                        {app.name}
                      </td>
                      <td className="px-6 py-4.5 text-xs text-text2">
                        <span className="px-2.5 py-1 rounded-lg bg-surface2 border border-border/80 capitalize font-medium">
                          {app.runtime}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-xs">
                        <span className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] px-2.5 py-1 rounded-full border ${
                          app.liveStatus === 'running'
                            ? 'bg-green-500/10 border-green-500/20 text-green-400'
                            : app.liveStatus === 'starting'
                            ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            app.liveStatus === 'running' ? 'bg-green-400 animate-pulse' : app.liveStatus === 'starting' ? 'bg-yellow-400 animate-spin' : 'bg-red-400'
                          }`}></span>
                          {app.liveStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4.5">
                        <code className="text-xs text-muted font-mono">{app.start_cmd.slice(0, 45)}</code>
                      </td>
                      <td className="px-6 py-4.5 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                          {isRunning ? (
                            <>
                              <button
                                onClick={e => handleAction(e, app.id, 'stop')}
                                title="Stop Application"
                                className="p-2 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 transition-colors"
                              >
                                <Square className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={e => handleAction(e, app.id, 'restart')}
                                title="Restart Application"
                                className="p-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={e => handleAction(e, app.id, 'start')}
                              title="Start Application"
                              className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-500 transition-colors"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onOpenApp(app.id, 'console')}
                            title="Terminal Console"
                            className="p-2 rounded-lg bg-surface2 hover:bg-border text-text2 transition-colors"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={e => handleDelete(e, app.id)}
                            title="Delete Application"
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Host System Info */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
        <h4 className="font-bold text-text mb-4">Host System details</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            ['OS Distro', `${stats?.os?.distro} ${stats?.os?.release}`],
            ['Hostname', stats?.os?.hostname],
            ['Architecture', stats?.os?.arch],
            ['CPU Cores', stats?.cpu?.cores],
            ['Uptime', stats?.os?.uptime ? `${Math.floor(stats.os.uptime / 3600)} hours` : 'Detecting...'],
            ['Load Average', stats?.cpu?.load?.map(l => l.toFixed(2)).join(', ') || 'N/A']
          ].map(([k, v], i) => (
            <div key={i} className="bg-bg2/40 border border-border/40 rounded-xl p-3.5">
              <span className="block text-[10px] text-muted uppercase font-bold tracking-wider">{k}</span>
              <span className="block text-sm font-semibold text-text mt-1">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
