import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { 
  Server, 
  Plus, 
  Trash2, 
  Terminal, 
  CheckCircle, 
  XCircle, 
  Cpu, 
  HardDrive, 
  Key, 
  Activity, 
  Copy, 
  Check, 
  RefreshCw 
} from 'lucide-react';

export default function Nodes({ onRefreshTrigger }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [copied, setCopied] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState(9900);
  const [token, setToken] = useState('');

  const loadNodes = async () => {
    setLoading(true);
    try {
      const data = await api('/nodes');
      setNodes(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNodes();
  }, [onRefreshTrigger]);

  const generateRandomToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.-';
    let result = 'orbiton_daemon_secret_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setToken(result);
  };

  const handleCreateNode = async (e) => {
    e.preventDefault();
    if (!name || !ip || !port || !token) return alert('All fields are required.');

    try {
      await api('/nodes', 'POST', { name, ip, port: parseInt(port), token });
      setModalOpen(false);
      // Reset form
      setName('');
      setIp('');
      setPort(9900);
      setToken('');
      loadNodes();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteNode = async (id, nodeName) => {
    if (!confirm(`Are you sure you want to delete node "${nodeName}"? This action cannot be undone.`)) return;

    try {
      await api(`/nodes/${id}`, 'DELETE');
      loadNodes();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleViewConfig = async (id) => {
    try {
      const res = await api(`/nodes/${id}/config`);
      setSelectedConfig(res);
      setConfigModalOpen(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Telemetry Aggregates
  const totalServers = nodes.reduce((sum, n) => sum + (n.serversCount || 0), 0);
  const onlineCount = nodes.filter(n => n.status === 'online').length;
  const totalCores = nodes.reduce((sum, n) => sum + (n.cpuCores || 0), 0);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-text mb-2 text-lg">🪐 Orbiton Daemon Nodes Manager</h3>
          <p className="text-xs text-muted">Configure multiple external VPS hosts running Orbiton Daemon wings to scale your architecture.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadNodes}
            className="p-2.5 rounded-xl border border-border text-text2 hover:bg-surface hover:text-text transition-all flex items-center gap-2 text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            Ping Nodes
          </button>
          <button
            onClick={() => {
              setModalOpen(true);
              generateRandomToken();
            }}
            className="bg-accent hover:bg-accent/90 active:scale-95 text-white font-semibold text-sm py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-accent/15"
          >
            <Plus className="w-4 h-4" />
            Add Node
          </button>
        </div>
      </div>

      {/* Telemetry Aggregates Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] text-muted uppercase font-bold tracking-wider">Total Allocated Servers</span>
            <span className="text-xl font-bold text-text mt-1 block">{totalServers} running</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] text-muted uppercase font-bold tracking-wider">Node Daemon Status</span>
            <span className="text-xl font-bold text-text mt-1 block">{onlineCount} / {nodes.length} Online</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] text-muted uppercase font-bold tracking-wider">Total CPU Processing Threads</span>
            <span className="text-xl font-bold text-text mt-1 block">{totalCores} vCPU threads</span>
          </div>
        </div>
      </div>

      {/* Nodes List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nodes.map(node => (
          <div
            key={node.id}
            className={`border rounded-2xl p-5 flex flex-col justify-between gap-5 transition-all shadow-lg ${
              node.status === 'online'
                ? 'bg-green-500/[0.01] border-green-500/10 hover:border-green-500/25'
                : 'bg-red-500/[0.01] border-red-500/15 hover:border-red-500/25'
            }`}
          >
            <div>
              {/* Card Title Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="overflow-hidden">
                  <h4 className="font-bold text-text text-base truncate flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-accent" />
                    {node.name}
                  </h4>
                  <span className="text-[10px] text-muted block font-mono mt-0.5 truncate">{node.ip}:{node.port}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider flex items-center gap-1.5 ${
                  node.status === 'online'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                  {node.status.toUpperCase()}
                </span>
              </div>

              {/* Realtime Stats Block */}
              <div className="mt-4 space-y-2 text-xs border-t border-border/50 pt-3">
                <div className="flex justify-between">
                  <span className="text-muted">Daemon Version:</span>
                  <span className="font-semibold text-text2">{node.status === 'online' ? node.daemonVersion : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">System OS:</span>
                  <span className="font-semibold text-text2 truncate max-w-[150px]">{node.status === 'online' ? node.systemInfo : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">CPU Processing:</span>
                  <span className="font-semibold text-text2">{node.status === 'online' ? `${node.cpuCores} Threads` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Available Memory:</span>
                  <span className="font-semibold text-text2">{node.status === 'online' ? formatBytes(node.freeMem) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Allocated Servers:</span>
                  <span className="font-semibold text-accent">{node.serversCount} servers</span>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-2 border-t border-border/50 pt-3 mt-1">
              <button
                onClick={() => handleViewConfig(node.id)}
                className="flex-1 bg-surface hover:bg-surface2 border border-border text-text2 hover:text-text font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <Terminal className="w-3.5 h-3.5" />
                Setup Configuration
              </button>
              
              {node.id !== 1 && (
                <button
                  onClick={() => handleDeleteNode(node.id, node.name)}
                  disabled={node.serversCount > 0}
                  className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${
                    node.serversCount > 0
                      ? 'border-border text-muted/30 cursor-not-allowed'
                      : 'border-red-500/10 text-red-500 hover:bg-red-500/10'
                  }`}
                  title={node.serversCount > 0 ? "Cannot delete: Node contains active server allocations" : "Delete Daemon Connection"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Node Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-bg2 border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-bg">
              <h3 className="font-bold text-text flex items-center gap-2">
                <Plus className="w-5 h-5 text-accent" />
                Add External Daemon Node
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-muted hover:text-text text-xl font-bold">×</button>
            </div>
            
            <form onSubmit={handleCreateNode} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Node Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. US-Node-1"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">IP Address / Domain</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 192.168.1.100"
                    value={ip}
                    onChange={e => setIp(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Daemon Port</label>
                  <input
                    type="number"
                    required
                    value={port}
                    onChange={e => setPort(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5 flex justify-between">
                  <span>Secure Token (Master Key)</span>
                  <button
                    type="button"
                    onClick={generateRandomToken}
                    className="text-accent hover:underline lowercase font-semibold"
                  >
                    Generate Random Key
                  </button>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Master key to connect securely"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text font-mono focus:border-accent outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 bg-surface hover:bg-surface2 border border-border rounded-xl text-xs font-semibold text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-accent hover:bg-accent/90 rounded-xl text-xs font-semibold text-white shadow-md shadow-accent/15"
                >
                  Save Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Setup Config Modal */}
      {configModalOpen && selectedConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-bg2 border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-bg">
              <h3 className="font-bold text-text flex items-center gap-2">
                <Key className="w-5 h-5 text-accent" />
                Daemon Wings Setup Config
              </h3>
              <button onClick={() => setConfigModalOpen(false)} className="text-muted hover:text-text text-xl font-bold">×</button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div>
                <p className="text-xs text-muted leading-relaxed">
                  To establish communication, copy the configuration JSON block below and save it as <code className="font-mono text-accent bg-accent/5 px-1.5 py-0.5 rounded text-[11px]">config.json</code> in your daemon folder. Alternatively, run the quick bash command on the node server.
                </p>
              </div>

              {/* Config JSON code block */}
              <div>
                <div className="flex items-center justify-between bg-bg px-4 py-2 border border-b-0 border-border rounded-t-xl">
                  <span className="text-[10px] text-muted font-mono">{selectedConfig.filename}</span>
                  <button
                    onClick={() => handleCopy(selectedConfig.content)}
                    className="text-muted hover:text-text flex items-center gap-1 text-[11px] font-semibold"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="w-full bg-[#030307] border border-border rounded-b-xl p-4 font-mono text-xs text-green-400 overflow-x-auto">
                  {selectedConfig.content}
                </pre>
              </div>

              {/* SSH Quick Command Code Block */}
              <div>
                <div className="flex items-center justify-between bg-bg px-4 py-2 border border-b-0 border-border rounded-t-xl">
                  <span className="text-[10px] text-muted font-bold uppercase tracking-wider">SSH Node Quick Auto Setup Command</span>
                  <button
                    onClick={() => handleCopy(selectedConfig.cmd)}
                    className="text-muted hover:text-text flex items-center gap-1 text-[11px] font-semibold"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="w-full bg-[#030307] border border-border rounded-b-xl p-4 font-mono text-xs text-yellow-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {selectedConfig.cmd}
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-bg flex justify-end">
              <button
                onClick={() => setConfigModalOpen(false)}
                className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
