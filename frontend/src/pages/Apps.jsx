import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Server, Play, Square, RotateCw, Terminal, Edit, Trash, Plus, FileCode, CheckCircle } from 'lucide-react';

export default function Apps({ onOpenApp, onRefreshTrigger }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form states
  const [appId, setAppId] = useState(null); // for editing
  const [name, setName] = useState('');
  const [runtime, setRuntime] = useState('nodejs');
  const [startCmd, setStartCmd] = useState('node index.js');
  const [maxRam, setMaxRam] = useState(512);
  const [autoRestart, setAutoRestart] = useState(true);
  const [envVars, setEnvVars] = useState('{}');
  const [importType, setImportType] = useState('manual');
  
  // Git / ZIP / Docker states
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [zipFile, setZipFile] = useState(null);
  const [dockerImage, setDockerImage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templates, setTemplates] = useState({});

  const [tplEnv, setTplEnv] = useState('');

  const loadApps = async () => {
    setLoading(true);
    try {
      const data = await api('/apps');
      setApps(data);
      const tpls = await api('/apps/templates').catch(() => ({}));
      setTemplates(tpls);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApps();
  }, [onRefreshTrigger]);

  const handleAction = async (e, appId, action) => {
    e.stopPropagation();
    try {
      await api(`/apps/${appId}/${action}`, 'POST');
      loadApps();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenCreate = () => {
    setAppId(null);
    setName('');
    setRuntime('nodejs');
    setStartCmd('node index.js');
    setMaxRam(512);
    setAutoRestart(true);
    setEnvVars('{}');
    setImportType('manual');
    setGitUrl('');
    setGitBranch('main');
    setZipFile(null);
    setDockerImage('');
    setSelectedTemplate('');
    setTplEnv('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (e, app) => {
    e.stopPropagation();
    setAppId(app.id);
    setName(app.name);
    setRuntime(app.runtime);
    setStartCmd(app.start_cmd);
    setMaxRam(app.max_ram);
    setAutoRestart(!!app.auto_restart);
    setEnvVars(JSON.stringify(app.env_vars || {}, null, 2));
    setImportType('manual');
    setIsModalOpen(true);
  };

  const handleDelete = async (e, appId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this server? All files will be deleted.')) return;
    try {
      await api(`/apps/${appId}`, 'DELETE');
      loadApps();
    } catch (err) {
      alert(err.message);
    }
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
      max_ram: parseInt(maxRam),
      auto_restart: autoRestart ? 1 : 0,
      env_vars: envObj,
      import_type: importType,
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
      if (appId) {
        await api(`/apps/${appId}`, 'PUT', payload);
      } else {
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
      }
      setIsModalOpen(false);
      loadApps();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTemplateSelect = (key, tpl) => {
    setSelectedTemplate(key);
    setTplEnv(tpl.env_hint || '{}');
  };

  const getRuntimeIcon = (r) => {
    const icons = {
      nodejs: '🟩',
      python3: '🐍',
      java: '☕',
      docker: '🐳',
      golang: '🔵',
      rust: '🦀'
    };
    return icons[r] || '⚙️';
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
          <p className="text-xs text-muted">A list of all server processes and running containers</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-accent hover:bg-accent/90 active:scale-95 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-accent/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create New Server
        </button>
      </div>

      {/* Apps Grid */}
      {!apps.length ? (
        <div className="bg-surface border border-border rounded-2xl p-16 text-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-surface2 border border-border flex items-center justify-center text-4xl mx-auto mb-4">🚀</div>
          <h3 className="text-xl font-bold text-text">No active servers</h3>
          <p className="text-sm text-muted mt-2 max-w-sm mx-auto">Create a server manually, clone a Git repository, import a zip file, or deploy templates like Discord.js bots, Express backend servers, or Minecraft servers.</p>
          <button
            onClick={handleOpenCreate}
            className="mt-6 bg-accent hover:bg-accent/90 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all"
          >
            Deploy Server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {apps.map((app) => {
            const isRunning = app.liveStatus === 'running' || app.liveStatus === 'starting';
            return (
              <div
                key={app.id}
                onClick={() => onOpenApp(app.id)}
                className="bg-surface border border-border rounded-2xl p-6 shadow-md hover:border-border2 hover:shadow-xl hover:shadow-accent/5 cursor-pointer transition-all group flex flex-col justify-between min-h-[180px]"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-surface2 border border-border flex items-center justify-center text-xl">
                      {getRuntimeIcon(app.runtime)}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] px-2.5 py-1 rounded-full border ${
                      app.liveStatus === 'running'
                        ? 'bg-green-500/10 border-green-500/20 text-green-400'
                        : app.liveStatus === 'starting'
                        ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${
                        app.liveStatus === 'running' ? 'bg-green-400 animate-pulse' : app.liveStatus === 'starting' ? 'bg-yellow-400' : 'bg-red-400'
                      }`}></span>
                      {app.liveStatus}
                    </span>
                  </div>
                  <h4 className="font-bold text-text group-hover:text-accent transition-colors truncate">{app.name}</h4>
                  <p className="text-xs text-muted mt-1 font-mono truncate">{app.start_cmd}</p>
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-4 mt-6" onClick={e => e.stopPropagation()}>
                  <span className="text-[10px] text-muted font-mono">{app.id.slice(0, 8)}...</span>
                  <div className="flex gap-2">
                    {isRunning ? (
                      <>
                        <button
                          onClick={e => handleAction(e, app.id, 'stop')}
                          className="p-2 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 transition-colors"
                        >
                          <Square className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={e => handleAction(e, app.id, 'restart')}
                          className="p-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={e => handleAction(e, app.id, 'start')}
                        className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-500 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onOpenApp(app.id, 'console')}
                      className="p-2 rounded-lg bg-surface2 hover:bg-border text-text2 transition-colors"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => handleOpenEdit(e, app)}
                      className="p-2 rounded-lg bg-surface2 hover:bg-border text-text2 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => handleDelete(e, app.id)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deploy Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-bg2 border border-border rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-bg">
              <h3 className="font-bold text-text">{appId ? 'Edit Server Configuration' : 'Deploy Server Daemon'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-text font-bold text-xl">×</button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
              {/* Tabs for Create */}
              {!appId && (
                <div className="flex border-b border-border gap-2 pb-px overflow-x-auto">
                  {[
                    { id: 'manual', label: '✏️ Manual' },
                    { id: 'template', label: '⚡ Templates' },
                    { id: 'git', label: '🔀 Git Clone' },
                    { id: 'zip', label: '📦 ZIP Upload' },
                    { id: 'docker', label: '🐳 Docker' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setImportType(tab.id)}
                      className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-all border-b-2 ${
                        importType === tab.id
                          ? 'border-accent text-accent bg-accent/5'
                          : 'border-transparent text-muted hover:text-text'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Form Content */}
              <div className="space-y-4">
                {/* General Configs */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Server Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="My Web Server"
                      className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Memory Limit (MB)</label>
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

                {importType === 'manual' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Runtime Environment</label>
                      <select
                        value={runtime}
                        onChange={e => setRuntime(e.target.value)}
                        className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                      >
                        <option value="nodejs">Node.js</option>
                        <option value="python3">Python 3</option>
                        <option value="java">Java (OpenJDK)</option>
                        <option value="golang">Golang</option>
                        <option value="rust">Rust</option>
                        <option value="custom">Custom Command</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Startup Command</label>
                      <input
                        type="text"
                        required
                        value={startCmd}
                        onChange={e => setStartCmd(e.target.value)}
                        placeholder="node index.js"
                        className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Templates Tab */}
                {importType === 'template' && (
                  <div className="space-y-4">
                    <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Select Template Preset</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[160px] overflow-y-auto pr-2">
                      {Object.entries(templates).map(([key, t]) => (
                        <div
                          key={key}
                          onClick={() => handleTemplateSelect(key, t)}
                          className={`p-3 border rounded-xl cursor-pointer text-center transition-all ${
                            selectedTemplate === key
                              ? 'border-accent bg-accent/5 shadow-md shadow-accent/10'
                              : 'border-border bg-bg hover:border-border2'
                          }`}
                        >
                          <span className="text-xl block mb-1">{t.icon || '📦'}</span>
                          <span className="text-xs font-semibold text-text block">{t.name}</span>
                        </div>
                      ))}
                    </div>
                    {selectedTemplate && (
                      <div>
                        <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Template Environment Variables (JSON)</label>
                        <textarea
                          value={tplEnv}
                          onChange={e => setTplEnv(e.target.value)}
                          placeholder='{ "TOKEN": "my-secret-key" }'
                          rows="4"
                          className="w-full bg-bg border border-border focus:border-accent text-text font-mono rounded-xl p-3 outline-none transition-colors text-sm"
                        ></textarea>
                      </div>
                    )}
                  </div>
                )}

                {/* Git Tab */}
                {importType === 'git' && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
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
                      <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Branch</label>
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

                {/* ZIP Tab */}
                {importType === 'zip' && (
                  <div>
                    <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Upload Application ZIP</label>
                    <div className="border-2 border-dashed border-border hover:border-accent/50 rounded-xl p-6 text-center cursor-pointer transition-colors relative">
                      <input
                        type="file"
                        required={!appId}
                        accept=".zip"
                        onChange={e => setZipFile(e.target.files[0])}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <span className="text-2xl block mb-2">📦</span>
                      <span className="text-xs font-semibold text-text block">
                        {zipFile ? zipFile.name : 'Drag & drop application ZIP here or click to select'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Docker Tab */}
                {importType === 'docker' && (
                  <div>
                    <label className="block text-xs font-bold text-text2 uppercase tracking-wider mb-2">Docker Image Name</label>
                    <input
                      type="text"
                      required
                      value={dockerImage}
                      onChange={e => setDockerImage(e.target.value)}
                      placeholder="nginx:latest"
                      className="w-full bg-bg border border-border focus:border-accent text-text rounded-xl p-3 outline-none transition-colors text-sm"
                    />
                  </div>
                )}

                {/* Environment Variables & Settings */}
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

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="auto-restart"
                    checked={autoRestart}
                    onChange={e => setAutoRestart(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent w-4 h-4"
                  />
                  <label htmlFor="auto-restart" className="text-xs font-bold text-text2 uppercase tracking-wider cursor-pointer">
                    Enable Auto-Restart Daemon
                  </label>
                </div>
              </div>

              {/* Submit Actions */}
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
                  {appId ? 'Save Changes' : 'Deploy Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
