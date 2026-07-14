import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { io } from 'socket.io-client';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Monitor({ onRefreshTrigger }) {
  const [processes, setProcesses] = useState([]);
  const [cpuHistory, setCpuHistory] = useState(Array(20).fill(0));
  const [ramHistory, setRamHistory] = useState(Array(20).fill(0));
  const [labels, setLabels] = useState(Array(20).fill(''));
  const [cpuLive, setCpuLive] = useState(0);
  const [ramLive, setRamLive] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const socket = io({ auth: { token }, transports: ['websocket'] });

    // Join metrics room for Node 1
    socket.emit('metrics:subscribe', { nodeId: 1 });

    socket.on('metrics:data', ({ stats }) => {
      setCpuLive(stats.cpu.usage);
      setRamLive(stats.memory.usedPercent);
      setLoading(false);

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setCpuHistory(prev => {
        const next = [...prev, stats.cpu.usage];
        if (next.length > 20) next.shift();
        return next;
      });

      setRamHistory(prev => {
        const next = [...prev, stats.memory.usedPercent];
        if (next.length > 20) next.shift();
        return next;
      });

      setLabels(prev => {
        const next = [...prev, time];
        if (next.length > 20) next.shift();
        return next;
      });
    });

    const fetchProcesses = async () => {
      try {
        const procs = await api('/system/processes');
        setProcesses(procs.list || []);
      } catch (_) {}
    };

    fetchProcesses();
    const procInterval = setInterval(fetchProcesses, 6000);

    return () => {
      socket.emit('metrics:unsubscribe', { nodeId: 1 });
      socket.disconnect();
      clearInterval(procInterval);
    };
  }, [onRefreshTrigger]);

  // ─── 24-Hour metrics history log logic ────────────────────────
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await api('/system/metrics-history');
        setHistoryData(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
    const histInterval = setInterval(fetchHistory, 300000);
    return () => clearInterval(histInterval);
  }, []);

  const historyLabels = historyData.map(item => {
    const d = new Date(item.timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  const historyChartData = {
    labels: historyLabels,
    datasets: [
      {
        label: 'CPU Core Load (%)',
        data: historyData.map(item => item.cpu),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.02)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      },
      {
        label: 'Virtual RAM Load (%)',
        data: historyData.map(item => item.ram),
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.02)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }
    ]
  };

  const historyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { color: '#64748b', font: { size: 10, weight: 'bold' } }
      },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', maxTicksLimit: 12 }
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#64748b', callback: v => v + '%' }
      }
    },
    elements: { point: { radius: 1, hoverRadius: 5 } }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300, easing: 'easeOutQuart' },
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false },
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#64748b', fontSize: 10, callback: v => v + '%' }
      }
    },
    elements: {
      point: { radius: 0, hoverRadius: 4 },
      line: {
        shadowColor: 'rgba(0, 0, 0, 0.3)',
        shadowBlur: 10
      }
    }
  };

  const cpuChartData = {
    labels,
    datasets: [{
      data: cpuHistory,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.05)',
      borderWidth: 2.5,
      fill: true,
      tension: 0.45
    }]
  };

  const ramChartData = {
    labels,
    datasets: [{
      data: ramHistory,
      borderColor: '#a855f7',
      backgroundColor: 'rgba(168, 85, 247, 0.05)',
      borderWidth: 2.5,
      fill: true,
      tension: 0.45
    }]
  };

  return (
    <div className="space-y-6">
      {/* Chart Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CPU Chart */}
        <div className="relative bg-surface border border-border/80 rounded-2xl p-6 shadow-xl overflow-hidden group">
          <div className="absolute top-0 right-0 w-36 h-36 bg-yellow-500/10 rounded-full blur-3xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div>
              <h4 className="font-bold text-text">CPU Core Activity</h4>
              <p className="text-xs text-muted mt-1">Real-time load telemetry stream</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-yellow-500 tracking-tight">{loading ? '...' : cpuLive}</span>
              <span className="text-xs text-yellow-500/80 font-bold">%</span>
            </div>
          </div>
          <div className="h-[200px] relative z-10">
            <Line data={cpuChartData} options={chartOptions} />
          </div>
        </div>

        {/* RAM Chart */}
        <div className="relative bg-surface border border-border/80 rounded-2xl p-6 shadow-xl overflow-hidden group">
          <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/10 rounded-full blur-3xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div>
              <h4 className="font-bold text-text">Memory Utilization</h4>
              <p className="text-xs text-muted mt-1">Real-time virtual RAM stream</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-purple-400 tracking-tight">{loading ? '...' : ramLive}</span>
              <span className="text-xs text-purple-400/80 font-bold">%</span>
            </div>
          </div>
          <div className="h-[200px] relative z-10">
            <Line data={ramChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* 24-Hour Metric History Chart */}
      <div className="bg-surface border border-border/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-36 h-36 bg-accent/5 rounded-full blur-3xl opacity-30"></div>
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div>
            <h4 className="font-bold text-text">24-Hour System Analytics</h4>
            <p className="text-xs text-muted mt-1">Historical CPU and RAM utilization logs (5-min intervals)</p>
          </div>
          <span className="text-[10px] bg-accent/10 border border-accent/20 text-accent font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider relative z-10">
            24h History
          </span>
        </div>
        <div className="h-[260px] relative z-10">
          {loadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
            </div>
          ) : (
            <Line data={historyChartData} options={historyChartOptions} />
          )}
        </div>
      </div>

      {/* Processes Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-bg2/40">
          <div>
            <h3 className="font-bold text-text">Active Process Threads</h3>
            <p className="text-xs text-muted mt-0.5">Host kernel subprocess listings</p>
          </div>
          <span className="px-2.5 py-1 bg-surface2 border border-border rounded-lg text-xs font-bold text-text2">
            {processes.length} Processes
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-xs font-bold text-muted uppercase tracking-wider bg-bg2/20">
                <th className="px-6 py-3">PID</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">CPU %</th>
                <th className="px-6 py-3">Memory %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm">
              {processes.slice(0, 15).map((p, i) => (
                <tr key={i} className="hover:bg-surface/30">
                  <td className="px-6 py-3.5 font-mono text-muted">{p.pid}</td>
                  <td className="px-6 py-3.5 font-bold text-text">{p.name}</td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      ['running', 'active', 'sleep'].includes(p.status?.toLowerCase())
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-surface2 text-muted border border-border'
                    }`}>
                      {p.status || 'unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 font-mono text-yellow-500">{p.cpu?.toFixed(1) || '0.0'}%</td>
                  <td className="px-6 py-3.5 font-mono text-purple-400">{p.mem?.toFixed(1) || '0.0'}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
