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
  RefreshCw,
  Edit2,
  Sliders,
  Settings,
  ShieldAlert,
  Info
} from 'lucide-react';

export default function Nodes({ onRefreshTrigger }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [copied, setCopied] = useState(false);
  
  // Form Active Tab
  const [activeTab, setActiveTab] = useState('general');

  // Form State Object
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    ip: '',
    port: 9900,
    token: '',
    memory_limit: 0,
    memory_overalloc: 0,
    disk_limit: 0,
    disk_overalloc: 0,
    cpu_limit: 0,
    max_servers: 0,
    use_ssl: false,
    behind_proxy: false,
    public_host: '',
    upload_limit_mb: 100,
    user_file_quota_kb: 1024,
    maintenance_mode: false,
    maintenance_msg: 'This node is currently under maintenance.',
    tags: ''
  });

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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setEditingNodeId(null);
    setActiveTab('general');
    setFormData({
      name: '',
      description: '',
      location: '',
      ip: '',
      port: 9900,
      token: '',
      memory_limit: 0,
      memory_overalloc: 0,
      disk_limit: 0,
      disk_overalloc: 0,
      cpu_limit: 0,
      max_servers: 0,
      use_ssl: false,
      behind_proxy: false,
      public_host: '',
      upload_limit_mb: 100,
      user_file_quota_kb: 1024,
      maintenance_mode: false,
      maintenance_msg: 'This node is currently under maintenance.',
      tags: ''
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (node) => {
    setIsEditing(true);
    setEditingNodeId(node.id);
    setActiveTab('general');
    setFormData({
      name: node.name || '',
      description: node.description || '',
      location: node.location || '',
      ip: node.ip || '',
      port: node.port || 9900,
      token: node.token || '',
      memory_limit: node.memory_limit || 0,
      memory_overalloc: node.memory_overalloc || 0,
      disk_limit: node.disk_limit || 0,
      disk_overalloc: node.disk_overalloc || 0,
      cpu_limit: node.cpu_limit || 0,
      max_servers: node.max_servers || 0,
      use_ssl: node.use_ssl === 1 || node.use_ssl === true,
      behind_proxy: node.behind_proxy === 1 || node.behind_proxy === true,
      public_host: node.public_host || '',
      upload_limit_mb: node.upload_limit_mb || 100,
      user_file_quota_kb: node.user_file_quota_kb || 1024,
      maintenance_mode: node.maintenance_mode === 1 || node.maintenance_mode === true,
      maintenance_msg: node.maintenance_msg || 'This node is currently under maintenance.',
      tags: node.tags || ''
    });
    setModalOpen(true);
  };

  const handleSubmitNode = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.ip || !formData.port || !formData.token) {
      return alert('Name, IP, Port, and Secure Token are required.');
    }

    const payload = {
      ...formData,
      port: parseInt(formData.port),
      memory_limit: parseInt(formData.memory_limit) || 0,
      memory_overalloc: parseInt(formData.memory_overalloc) || 0,
      disk_limit: parseInt(formData.disk_limit) || 0,
      disk_overalloc: parseInt(formData.disk_overalloc) || 0,
      cpu_limit: parseInt(formData.cpu_limit) || 0,
      max_servers: parseInt(formData.max_servers) || 0,
      upload_limit_mb: parseInt(formData.upload_limit_mb) || 100,
      user_file_quota_kb: parseInt(formData.user_file_quota_kb) || 1024,
      use_ssl: formData.use_ssl ? 1 : 0,
      behind_proxy: formData.behind_proxy ? 1 : 0,
      maintenance_mode: formData.maintenance_mode ? 1 : 0
    };

    try {
      if (isEditing) {
        await api(`/nodes/${editingNodeId}`, 'PUT', payload);
      } else {
        await api('/nodes', 'POST', payload);
      }
      setModalOpen(false);
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

  const handleToggleMaintenance = async (id) => {
    try {
      const res = await api(`/nodes/${id}/maintenance`, 'POST');
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
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '—';
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
            onClick={handleOpenAddModal}
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
            className={`border rounded-2xl p-5 flex flex-col justify-between gap-5 transition-all shadow-lg relative ${
              node.maintenance_mode === 1
                ? 'bg-yellow-500/[0.02] border-yellow-500/20 hover:border-yellow-500/35'
                : node.status === 'online'
                ? 'bg-green-500/[0.01] border-green-500/10 hover:border-green-500/25'
                : 'bg-red-500/[0.01] border-red-500/15 hover:border-red-500/25'
            }`}
          >
            {node.maintenance_mode === 1 && (
              <div className="absolute top-2 right-2 bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-lg text-[9px] font-bold flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                MAINTENANCE
              </div>
            )}
            <div>
              {/* Card Title Header */}
              <div className="flex items-start justify-between gap-2 pr-16">
                <div className="overflow-hidden">
                  <h4 className="font-bold text-text text-base truncate flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-accent" />
                    {node.name}
                  </h4>
                  <span className="text-[10px] text-muted block font-mono mt-0.5 truncate">{node.ip}:{node.port}</span>
                </div>
                {node.maintenance_mode !== 1 && (
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider flex items-center gap-1.5 ${
                    node.status === 'online'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                    {node.status.toUpperCase()}
                  </span>
                )}
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
                  <span className="font-semibold text-text2">
                    {node.status === 'online' 
                      ? `${node.cpuCores} Threads (${node.cpuUsage}%)` 
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Available Memory:</span>
                  <span className="font-semibold text-text2">
                    {node.status === 'online' 
                      ? formatBytes(node.freeMem || (node.totalMem - node.usedMem)) 
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Allocated Servers:</span>
                  <span className="font-semibold text-accent">
                    {node.serversCount} {node.max_servers > 0 ? `/ ${node.max_servers}` : ''} servers
                  </span>
                </div>
                {node.diskTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted">Disk Storage:</span>
                    <span className="font-semibold text-text2">
                      {formatBytes(node.diskUsed)} / {formatBytes(node.diskTotal)}
                    </span>
                  </div>
                )}
                {node.location && (
                  <div className="flex justify-between">
                    <span className="text-muted">Location:</span>
                    <span className="font-semibold text-text2">{node.location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-2 border-t border-border/50 pt-3 mt-1">
              <button
                onClick={() => handleViewConfig(node.id)}
                className="bg-surface hover:bg-surface2 border border-border text-text2 hover:text-text font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
                title="View setup configuration command"
              >
                <Terminal className="w-3.5 h-3.5" />
                Setup
              </button>

              <button
                onClick={() => handleOpenEditModal(node)}
                className="bg-surface hover:bg-surface2 border border-border text-text2 hover:text-text font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
                title="Edit daemon connection settings"
              >
                <Sliders className="w-3.5 h-3.5 text-accent" />
                Edit
              </button>
              
              <button
                onClick={() => handleToggleMaintenance(node.id)}
                className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
                  node.maintenance_mode === 1
                    ? 'border-yellow-500/20 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
                    : 'border-border text-text2 hover:bg-surface'
                }`}
                title={node.maintenance_mode === 1 ? "Disable Maintenance Mode" : "Enable Maintenance Mode"}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
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

      {/* Add / Edit Node Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-bg2 border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-bg">
              <h3 className="font-bold text-text flex items-center gap-2">
                {isEditing ? <Sliders className="w-5 h-5 text-accent" /> : <Plus className="w-5 h-5 text-accent" />}
                {isEditing ? `Configure Node: ${formData.name}` : 'Add External Daemon Node'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-muted hover:text-text text-xl font-bold">×</button>
            </div>
            
            {/* Modal Tabs */}
            <div className="flex border-b border-border bg-bg px-4 py-1.5 gap-2 overflow-x-auto">
              {[
                { id: 'general', label: 'General' },
                { id: 'connection', label: 'Connection' },
                { id: 'resources', label: 'Resources' },
                { id: 'network', label: 'Network & SSL' },
                { id: 'limits', label: 'Limits & Maintenance' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-bold border-b-2 rounded-t-lg transition-all ${
                    activeTab === tab.id
                      ? 'border-accent text-accent bg-accent/5'
                      : 'border-transparent text-muted hover:text-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmitNode} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* TAB: GENERAL */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Node Name *</label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. US-Node-1"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Location</label>
                    <input
                      type="text"
                      name="location"
                      placeholder="e.g. Singapore Datacenter"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Description</label>
                    <textarea
                      name="description"
                      rows="2"
                      placeholder="Add brief details about this node host provider..."
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Tags (Comma-separated)</label>
                    <input
                      type="text"
                      name="tags"
                      placeholder="e.g. amd64, nvme, production"
                      value={formData.tags}
                      onChange={handleInputChange}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB: CONNECTION */}
              {activeTab === 'connection' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">IP Address / Domain *</label>
                      <input
                        type="text"
                        name="ip"
                        required
                        placeholder="e.g. 103.179.189.161"
                        value={formData.ip}
                        onChange={handleInputChange}
                        className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Daemon Port *</label>
                      <input
                        type="number"
                        name="port"
                        required
                        value={formData.port}
                        onChange={handleInputChange}
                        className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">
                      Secure Token (Master Key) *
                    </label>
                    <input
                      type="text"
                      name="token"
                      required
                      placeholder="Enter the secure daemon token..."
                      value={formData.token}
                      onChange={handleInputChange}
                      className="w-full bg-surface2 border border-border focus:border-accent text-white font-mono rounded-xl px-4 py-2.5 text-sm outline-none transition-all shadow-inner"
                    />
                    <p className="text-[10px] text-muted mt-1.5 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-accent" />
                      Must match the DAEMON_TOKEN defined in the daemon's local .env file.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB: RESOURCES */}
              {activeTab === 'resources' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Memory Limit (MB)</label>
                      <input
                        type="number"
                        name="memory_limit"
                        value={formData.memory_limit}
                        onChange={handleInputChange}
                        placeholder="0 for unlimited"
                        className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Memory Over-allocation (%)</label>
                      <input
                        type="number"
                        name="memory_overalloc"
                        value={formData.memory_overalloc}
                        onChange={handleInputChange}
                        className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Disk Limit (GB)</label>
                      <input
                        type="number"
                        name="disk_limit"
                        value={formData.disk_limit}
                        onChange={handleInputChange}
                        placeholder="0 for unlimited"
                        className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Disk Over-allocation (%)</label>
                      <input
                        type="number"
                        name="disk_overalloc"
                        value={formData.disk_overalloc}
                        onChange={handleInputChange}
                        className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">CPU Limit (%)</label>
                      <input
                        type="number"
                        name="cpu_limit"
                        value={formData.cpu_limit}
                        onChange={handleInputChange}
                        placeholder="0 for unlimited"
                        className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Max Allocated Servers</label>
                      <input
                        type="number"
                        name="max_servers"
                        value={formData.max_servers}
                        onChange={handleInputChange}
                        placeholder="0 for unlimited"
                        className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: NETWORK & SSL */}
              {activeTab === 'network' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between p-3.5 bg-surface border border-border rounded-xl">
                    <div>
                      <h5 className="text-xs font-bold text-text">Use SSL Connection (HTTPS/WSS)</h5>
                      <p className="text-[10px] text-muted mt-0.5">Encrypt all communications between Panel and Daemon.</p>
                    </div>
                    <input
                      type="checkbox"
                      name="use_ssl"
                      checked={formData.use_ssl}
                      onChange={handleInputChange}
                      className="w-4.5 h-4.5 accent-accent"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-surface border border-border rounded-xl">
                    <div>
                      <h5 className="text-xs font-bold text-text">Behind Reverse Proxy</h5>
                      <p className="text-[10px] text-muted mt-0.5">Check if this node connects through Cloudflare Tunnel or Nginx proxy.</p>
                    </div>
                    <input
                      type="checkbox"
                      name="behind_proxy"
                      checked={formData.behind_proxy}
                      onChange={handleInputChange}
                      className="w-4.5 h-4.5 accent-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Public Host (FQDN)</label>
                    <input
                      type="text"
                      name="public_host"
                      placeholder="e.g. daemon.mybrand.com"
                      value={formData.public_host}
                      onChange={handleInputChange}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB: LIMITS & MAINTENANCE */}
              {activeTab === 'limits' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Upload Limit (MB)</label>
                      <input
                        type="number"
                        name="upload_limit_mb"
                        value={formData.upload_limit_mb}
                        onChange={handleInputChange}
                        className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">User File Quota (KB)</label>
                      <input
                        type="number"
                        name="user_file_quota_kb"
                        value={formData.user_file_quota_kb}
                        onChange={handleInputChange}
                        className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-yellow-500/[0.02] border border-yellow-500/20 rounded-xl">
                    <div>
                      <h5 className="text-xs font-bold text-yellow-500">Enable Maintenance Mode</h5>
                      <p className="text-[10px] text-muted mt-0.5">Prevent new server creation and notify sub-users.</p>
                    </div>
                    <input
                      type="checkbox"
                      name="maintenance_mode"
                      checked={formData.maintenance_mode}
                      onChange={handleInputChange}
                      className="w-4.5 h-4.5 accent-yellow-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Maintenance Message</label>
                    <textarea
                      name="maintenance_msg"
                      rows="2"
                      value={formData.maintenance_msg}
                      onChange={handleInputChange}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Form Footer */}
              <div className="pt-4 border-t border-border flex justify-end gap-3 bg-bg2">
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
                  {isEditing ? 'Save Changes' : 'Create Connection'}
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
