import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  Server, 
  ArrowLeft, 
  Plus, 
  FileCode, 
  CheckCircle,
  GitBranch,
  Upload,
  Box,
  ShieldAlert,
  RefreshCw
} from 'lucide-react';

export default function CreateNewApp({ onBack, onRefresh }) {
  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(1);
  const [loadingNodes, setLoadingNodes] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [runtime, setRuntime] = useState('nodejs');
  const [startCmd, setStartCmd] = useState('index.js');
  const [installCmd, setInstallCmd] = useState('package.json');
  const [maxRam, setMaxRam] = useState(512);
  const [autoRestart, setAutoRestart] = useState(true);
  const [envVars, setEnvVars] = useState('{}');
  const [importType, setImportType] = useState('manual');

  // Git / ZIP / Docker / Template states
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [zipFile, setZipFile] = useState(null);
  const [dockerImage, setDockerImage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templates, setTemplates] = useState({});
  const [tplEnv, setTplEnv] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    // Load nodes and templates
    const loadData = async () => {
      try {
        const nodesData = await api('/nodes').catch(() => []);
        setNodes(nodesData);
        if (nodesData.length > 0) {
          setSelectedNodeId(nodesData[0].id);
        }
        const tpls = await api('/apps/templates').catch(() => ({}));
        setTemplates(tpls);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingNodes(false);
      }
    };
    loadData();
  }, []);

  const handleRuntimeChange = (val) => {
    setRuntime(val);
    const defaults = {
      nodejs: 'index.js',
      python3: 'main.py',
      java: 'server.jar',
      golang: 'main.go',
      rust: 'Cargo.toml',
      'docker-compose': 'docker-compose.yml',
      custom: 'start.sh'
    };
    const installDefaults = {
      nodejs: 'package.json',
      python3: 'requirements.txt',
      java: '',
      golang: '',
      rust: '',
      'docker-compose': '',
      custom: ''
    };
    setStartCmd(defaults[val] || 'index.js');
    setInstallCmd(installDefaults[val] || '');
  };

  const handleTemplateSelect = (key, tpl) => {
    setSelectedTemplate(key);
    setTplEnv(tpl.env_hint || '{}');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    let envObj = {};
    try {
      envObj = JSON.parse(envVars);
    } catch (_) {
      alert('Invalid environment variables JSON syntax.');
      return;
    }

    const payload = {
      name,
      runtime,
      start_cmd: startCmd,
      install_cmd: installCmd,
      max_ram: parseInt(maxRam),
      auto_restart: autoRestart ? 1 : 0,
      env_vars: envObj,
      import_type: importType,
      node_id: parseInt(selectedNodeId)
    };

    if (importType === 'git') {
      payload.git_url = gitUrl;
      payload.git_branch = gitBranch;
    } else if (importType === 'docker') {
      payload.docker_image = dockerImage;
    } else if (importType === 'template') {
      payload.template = selectedTemplate;
      try {
        payload.env_vars = JSON.parse(tplEnv || '{}');
      } catch (_) {
        alert('Invalid template environment variables JSON syntax.');
        return;
      }
    }

    setSubmitLoading(true);

    // ZIP upload needs FormData
    let body = payload;
    let isMultipart = false;
    if (importType === 'zip' && zipFile) {
      isMultipart = true;
      const fd = new FormData();
      fd.append('zip', zipFile);
      Object.entries(payload).forEach(([k, v]) => {
        if (typeof v === 'object') fd.append(k, JSON.stringify(v));
        else fd.append(k, v);
      });
      body = fd;
    }

    try {
      if (isMultipart) {
        const res = await fetch('/api/apps', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      } else {
        await api('/apps', 'POST', payload);
      }

      onRefresh();
      onBack();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const getTemplateIcon = (key, t) => {
    const urls = {
      nodejs_generic: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
      python_generic: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
      java_generic: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg',
      discord_js: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
      discord_py: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
      express_api: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/express/express-original.svg',
      fastapi: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/fastapi/fastapi-original.svg',
      minecraft: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg'
    };
    const src = urls[key] || 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/codepen/codepen-plain.svg';
    return <img src={src} alt={t.name} className="w-6 h-6 object-contain mx-auto mb-1.5" />;
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack} 
          className="p-2 bg-surface hover:bg-surface2 border border-border rounded-xl text-text2 hover:text-text transition-all"
          title="Back to Servers"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-text">Deploy New Server</h1>
          <p className="text-xs text-muted">Create a new containerized daemon service on local or remote nodes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Options Form Card */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <form onSubmit={handleFormSubmit} className="space-y-6">
            {/* Deploy Mode Tabs */}
            <div className="flex border-b border-border gap-2 pb-px overflow-x-auto">
              {[
                { id: 'manual', label: '✏️ Manual' },
                { id: 'template', label: '⚡ Templates' },
                { id: 'git', label: '🔀 Git Clone' },
                { id: 'zip', label: '📦 ZIP Upload' },
                { id: 'docker', label: '🐳 Docker Image' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setImportType(tab.id)}
                  className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                    importType === tab.id
                      ? 'border-accent text-accent bg-accent/5'
                      : 'border-transparent text-muted hover:text-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {/* Node selection */}
              {!loadingNodes && nodes.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Target Node Host</label>
                  <select
                    value={selectedNodeId}
                    onChange={e => setSelectedNodeId(e.target.value)}
                    className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm font-semibold"
                  >
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.ip}:{n.port}) — {n.status.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* General details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Server Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="My Application Server"
                    className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Memory Allocation (MB)</label>
                  <input
                    type="number"
                    required
                    value={maxRam}
                    onChange={e => setMaxRam(e.target.value)}
                    placeholder="512"
                    className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                  />
                </div>
              </div>

              {/* Manual Fields */}
              {importType === 'manual' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Runtime Environment</label>
                      <select
                        value={runtime}
                        onChange={e => handleRuntimeChange(e.target.value)}
                        className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                      >
                        <option value="nodejs">Node.js</option>
                        <option value="python3">Python 3</option>
                        <option value="java">Java (OpenJDK)</option>
                        <option value="golang">Golang</option>
                        <option value="rust">Rust</option>
                        <option value="docker-compose">Docker Compose</option>
                        <option value="custom">Custom Command</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Startup File</label>
                      <input
                        type="text"
                        required
                        value={startCmd}
                        onChange={e => setStartCmd(e.target.value)}
                        placeholder="e.g. main.py, index.js, server.jar"
                        className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Install File (Optional)</label>
                    <input
                      type="text"
                      value={installCmd}
                      onChange={e => setInstallCmd(e.target.value)}
                      placeholder="e.g. requirements.txt, package.json (Leave blank to skip)"
                      className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Template selection list */}
              {importType === 'template' && (
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Select Template Preset</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[220px] overflow-y-auto pr-2">
                    {Object.entries(templates).map(([key, t]) => (
                      <div
                        key={key}
                        onClick={() => handleTemplateSelect(key, t)}
                        className={`p-4 border rounded-xl cursor-pointer text-center transition-all ${
                          selectedTemplate === key
                            ? 'border-accent bg-accent/5 shadow-md shadow-accent/15'
                            : 'border-border bg-bg hover:border-border2'
                        }`}
                      >
                        {getTemplateIcon(key, t)}
                        <span className="text-xs font-bold text-text block">{t.name}</span>
                      </div>
                    ))}
                  </div>
                  {selectedTemplate && (
                    <div className="page-fade-in">
                      <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Template Environment Variables (JSON)</label>
                      <textarea
                        value={tplEnv}
                        onChange={e => setTplEnv(e.target.value)}
                        placeholder='{ "TOKEN": "your-bot-token" }'
                        rows="4"
                        className="w-full bg-bg border border-border focus:border-accent text-text font-mono rounded-xl p-3 outline-none transition-colors text-sm"
                      ></textarea>
                    </div>
                  )}
                </div>
              )}

              {/* Git configuration */}
              {importType === 'git' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 page-fade-in">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Git Repository URL</label>
                    <input
                      type="url"
                      required
                      value={gitUrl}
                      onChange={e => setGitUrl(e.target.value)}
                      placeholder="https://github.com/username/repo.git"
                      className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Branch / Tag</label>
                    <input
                      type="text"
                      required
                      value={gitBranch}
                      onChange={e => setGitBranch(e.target.value)}
                      placeholder="main"
                      className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                    />
                  </div>
                </div>
              )}

              {/* ZIP Upload configuration */}
              {importType === 'zip' && (
                <div className="page-fade-in">
                  <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Upload Application ZIP</label>
                  <div className="border border-dashed border-border hover:border-accent rounded-xl p-8 text-center cursor-pointer relative bg-bg2/20 transition-all">
                    <input
                      type="file"
                      required
                      accept=".zip"
                      onChange={e => setZipFile(e.target.files[0])}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="w-8 h-8 text-muted mx-auto mb-2" />
                    <span className="text-xs font-semibold text-text block">
                      {zipFile ? zipFile.name : 'Select file (Drag & drop application ZIP)'}
                    </span>
                    <span className="text-[10px] text-muted mt-1 block">Limit 500MB • Will be unzipped in target work directory</span>
                  </div>
                </div>
              )}

              {/* Docker configuration */}
              {importType === 'docker' && (
                <div className="page-fade-in">
                  <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Docker Image Name</label>
                  <input
                    type="text"
                    required
                    value={dockerImage}
                    onChange={e => setDockerImage(e.target.value)}
                    placeholder="nginx:alpine"
                    className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                  />
                </div>
              )}

              {/* Environment vars (If not templates) */}
              {importType !== 'template' && (
                <div>
                  <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Environment Variables (JSON)</label>
                  <textarea
                    value={envVars}
                    onChange={e => setEnvVars(e.target.value)}
                    placeholder="{}"
                    rows="4"
                    className="w-full bg-bg border border-border focus:border-accent text-text font-mono rounded-xl p-3 outline-none transition-colors text-sm"
                  ></textarea>
                </div>
              )}

              {/* Checkboxes */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="auto-restart-cb"
                  checked={autoRestart}
                  onChange={e => setAutoRestart(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent w-4 h-4"
                />
                <label htmlFor="auto-restart-cb" className="text-xs font-bold text-text2 uppercase tracking-wider cursor-pointer select-none">
                  Enable Auto-Restart Daemon
                </label>
              </div>
            </div>

            {/* Actions button */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-3 border border-border rounded-xl text-sm font-semibold hover:bg-surface text-text2 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitLoading}
                className="px-5 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl text-sm font-semibold shadow-lg shadow-accent/15 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {submitLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Deploy Server
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Info Sidebar Card */}
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-text flex items-center gap-2">
              <Box className="w-5 h-5 text-accent" />
              Deployment Info
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Orbiton deploys each application container inside isolated processes or docker nodes depending on your selection.
            </p>
            <div className="border-t border-border/50 pt-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted">Available Memory</span>
                <span className="font-bold text-text">Unlimited</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted">Node Connection</span>
                <span className="font-bold text-green-400">Online</span>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl space-y-4 flex items-start gap-4">
            <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-xl border border-yellow-500/20">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-text">Secure Credentials</h4>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Always store API tokens and private keys inside the Environment Variables (JSON) instead of hardcoding them in git branches.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}