import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
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

  const fetchData = async () => {
    try {
      const [stats, procs] = await Promise.all([
        api('/system/stats'),
        api('/system/processes')
      ]);

      setCpuLive(stats.cpu.usage);
      setRamLive(stats.memory.usedPercent);
      setProcesses(procs.list || []);

      const time = new Date().toLocaleTimeString();

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
    } catch (_) {}
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [onRefreshTrigger]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false },
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b', callback: v => v + '%' }
      }
    },
    elements: { point: { radius: 0 } }
  };

  const cpuChartData = {
    labels,
    datasets: [{
      data: cpuHistory,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4
    }]
  };

  const ramChartData = {
    labels,
    datasets: [{
      data: ramHistory,
      borderColor: '#7c3aed',
      backgroundColor: 'rgba(124, 58, 237, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4
    }]
  };

  return (
    <div className="space-y-6">
      {/* Chart Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CPU Chart */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-text">CPU Usage history</h4>
              <p className="text-xs text-muted mt-1">Real-time usage statistics</p>
            </div>
            <span className="text-2xl font-extrabold text-yellow-500">{cpuLive}%</span>
          </div>
          <div className="h-[200px]">
            <Line data={cpuChartData} options={chartOptions} />
          </div>
        </div>

        {/* RAM Chart */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-text">RAM Usage history</h4>
              <p className="text-xs text-muted mt-1">Real-time memory statistics</p>
            </div>
            <span className="text-2xl font-extrabold text-accent">{ramLive}%</span>
          </div>
          <div className="h-[200px]">
            <Line data={ramChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Processes Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-bg2/40">
          <h3 className="font-bold text-text">Top Host Processes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-xs font-bold text-muted uppercase tracking-wider bg-bg2/20">
                <th className="px-6 py-3.5">PID</th>
                <th className="px-6 py-3.5">Name</th>
                <th className="px-6 py-3.5">CPU</th>
                <th className="px-6 py-3.5">Memory</th>
                <th className="px-6 py-3.5">Command</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm">
              {processes.map((p, i) => (
                <tr key={i} className="hover:bg-surface/30">
                  <td className="px-6 py-3 font-mono text-muted">{p.pid}</td>
                  <td className="px-6 py-3 font-semibold text-text">{p.name}</td>
                  <td className={`px-6 py-3 font-semibold ${p.cpu > 50 ? 'text-red-500' : p.cpu > 20 ? 'text-yellow-500' : 'text-text'}`}>
                    {p.cpu}%
                  </td>
                  <td className="px-6 py-3 text-text2">{p.mem}%</td>
                  <td className="px-6 py-3 text-xs text-muted font-mono max-w-[280px] truncate" title={p.cmd}>{p.cmd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
