import React, { useEffect, useState, useRef } from 'react';
import { api, fmtBytes } from '../utils/api';
import { Folder, File, ArrowLeft, MoreVertical, Upload, Plus, FolderPlus, Save, Download, Trash2 } from 'lucide-react';

export default function FileManager({ onRefreshTrigger }) {
  const [apps, setApps] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  
  // Context Menu state
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, targetFile }
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    api('/apps').then(data => {
      setApps(data);
      if (data.length > 0) {
        setSelectedAppId(data[0].id);
      }
    }).catch(console.error);
  }, [onRefreshTrigger]);

  const loadFiles = async (appId, path) => {
    if (!appId) return;
    setLoading(true);
    try {
      const data = await api(`/files/${appId}/list?path=${encodeURIComponent(path)}`);
      setFiles(data.files || []);
      setCurrentPath(path);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAppId) {
      loadFiles(selectedAppId, '/');
      setSelectedFile(null);
      setFileContent('');
    }
  }, [selectedAppId]);

  const handleFolderClick = (folderName) => {
    const parent = currentPath === '/' ? '' : currentPath;
    const newPath = `${parent}/${folderName}`;
    loadFiles(selectedAppId, newPath);
  };

  const handleBackClick = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/');
    parts.pop();
    const newPath = parts.join('/') || '/';
    loadFiles(selectedAppId, newPath);
  };

  const handleFileClick = async (fileName) => {
    const parent = currentPath === '/' ? '' : currentPath;
    const filePath = `${parent}/${fileName}`;
    setSelectedFile(filePath);
    setFileLoading(true);
    try {
      const data = await api(`/files/${selectedAppId}/read?path=${encodeURIComponent(filePath)}`);
      setFileContent(data.content);
    } catch (err) {
      setFileContent(`// Error: ${err.message}`);
    } finally {
      setFileLoading(false);
    }
  };

  const handleSaveFile = async () => {
    if (!selectedFile) return;
    try {
      await api(`/files/${selectedAppId}/write`, 'POST', {
        path: selectedFile,
        content: fileContent
      });
      alert('File saved successfully!');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleNewFile = async () => {
    if (!selectedAppId) return;
    const name = prompt('Enter new file name:');
    if (!name) return;
    const parent = currentPath === '/' ? '' : currentPath;
    const filePath = `${parent}/${name}`;
    try {
      await api(`/files/${selectedAppId}/write`, 'POST', { path: filePath, content: '' });
      loadFiles(selectedAppId, currentPath);
      handleFileClick(name);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleNewFolder = async () => {
    if (!selectedAppId) return;
    const name = prompt('Enter new folder name:');
    if (!name) return;
    const parent = currentPath === '/' ? '' : currentPath;
    const folderPath = `${parent}/${name}`;
    try {
      await api(`/files/${selectedAppId}/mkdir`, 'POST', { path: folderPath });
      loadFiles(selectedAppId, currentPath);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e) => {
    const filesList = e.target.files;
    if (!filesList.length || !selectedAppId) return;
    const fd = new FormData();
    Array.from(filesList).forEach(f => fd.append('files', f));
    try {
      const res = await fetch(`/api/files/${selectedAppId}/upload?path=${encodeURIComponent(currentPath)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: fd
      });
      if (res.ok) {
        loadFiles(selectedAppId, currentPath);
      } else {
        const d = await res.json();
        alert(d.error);
      }
    } catch (err) {
      alert(err.message);
    }
    e.target.value = '';
  };

  const getFileIcon = (n) => {
    const ext = n.split('.').pop().toLowerCase();
    const icons = {
      js: '🟨', ts: '🔷', py: '🐍', java: '☕', json: '📋',
      md: '📝', sh: '🔧', env: '🔒', txt: '📄', log: '📋',
      jar: '☕', html: '🌐', css: '🎨', xml: '📄', yml: '⚙️',
      yaml: '⚙️', zip: '📦', tar: '📦', gz: '📦', dockerfile: '🐳'
    };
    return icons[ext] || '📄';
  };

  // Context Menu Handlers
  const handleContextMenu = (e, file) => {
    e.preventDefault();
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      targetFile: file
    });
  };

  const handleCtxAction = async (action) => {
    if (!ctxMenu) return;
    const file = ctxMenu.targetFile;
    const parent = currentPath === '/' ? '' : currentPath;
    const fp = `${parent}/${file.name}`;
    setCtxMenu(null);

    switch (action) {
      case 'rename': {
        const newName = prompt(`Rename "${file.name}" to:`, file.name);
        if (!newName || newName === file.name) return;
        const newPath = `${parent}/${newName}`;
        try {
          await api(`/files/${selectedAppId}/rename`, 'POST', { from: fp, to: newPath });
          if (selectedFile === fp) {
            setSelectedFile(newPath);
          }
          loadFiles(selectedAppId, currentPath);
        } catch (err) { alert(err.message); }
        break;
      }
      case 'move': {
        const dest = prompt(`Move "${file.name}" to path (e.g. /folder/subfolder):`, currentPath);
        if (!dest) return;
        const destPath = `${dest.endsWith('/') ? dest.slice(0, -1) : dest}/${file.name}`;
        try {
          await api(`/files/${selectedAppId}/move`, 'POST', { from: fp, to: destPath });
          loadFiles(selectedAppId, currentPath);
        } catch (err) { alert(err.message); }
        break;
      }
      case 'archive-zip':
      case 'archive-targz': {
        const fmt = action === 'archive-zip' ? 'zip' : 'tar.gz';
        const baseName = prompt('Archive name (without extension):', file.name.split('.')[0]);
        if (!baseName) return;
        try {
          await api(`/files/${selectedAppId}/archive`, 'POST', { path: fp, format: fmt, destName: baseName });
          loadFiles(selectedAppId, currentPath);
        } catch (err) { alert(err.message); }
        break;
      }
      case 'extract': {
        try {
          await api(`/files/${selectedAppId}/extract`, 'POST', { path: fp });
          loadFiles(selectedAppId, currentPath);
        } catch (err) { alert(err.message); }
        break;
      }
      case 'download': {
        window.open(`/api/files/${selectedAppId}/download?path=${encodeURIComponent(fp)}`);
        break;
      }
      case 'delete': {
        if (!confirm(`Delete "${file.name}"?`)) return;
        try {
          await api(`/files/${selectedAppId}/delete?path=${encodeURIComponent(fp)}`, 'DELETE');
          if (selectedFile === fp) {
            setSelectedFile(null);
            setFileContent('');
          }
          loadFiles(selectedAppId, currentPath);
        } catch (err) { alert(err.message); }
        break;
      }
    }
  };

  useEffect(() => {
    const hide = () => setCtxMenu(null);
    window.addEventListener('click', hide);
    return () => window.removeEventListener('click', hide);
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <select
            value={selectedAppId}
            onChange={e => setSelectedAppId(e.target.value)}
            className="bg-bg border border-border focus:border-accent text-text rounded-xl px-4 py-2.5 outline-none transition-colors text-sm font-semibold w-56"
          >
            {apps.map(app => (
              <option key={app.id} value={app.id}>🚀 {app.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUploadClick}
            className="p-2.5 rounded-xl border border-border text-text2 hover:bg-surface hover:text-text transition-all text-xs font-semibold flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload File
          </button>
          <button
            onClick={handleNewFile}
            className="p-2.5 rounded-xl border border-border text-text2 hover:bg-surface hover:text-text transition-all text-xs font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New File
          </button>
          <button
            onClick={handleNewFolder}
            className="p-2.5 rounded-xl border border-border text-text2 hover:bg-surface hover:text-text transition-all text-xs font-semibold flex items-center gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            Folder
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            className="hidden"
          />
        </div>
      </div>

      {/* Main Panel grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* File Browser list */}
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-xl flex flex-col h-[520px]">
          <div className="px-3 py-2 border-b border-border/80 flex items-center justify-between text-xs font-bold text-muted uppercase tracking-wider mb-2">
            <span>Folder: {currentPath}</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                {currentPath !== '/' && (
                  <div
                    onClick={handleBackClick}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium hover:bg-surface2 text-text2 hover:text-text cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 text-muted" />
                    <span>..</span>
                  </div>
                )}
                {files.map((file, i) => (
                  <div
                    key={i}
                    onClick={() => file.type === 'dir' ? handleFolderClick(file.name) : handleFileClick(file.name)}
                    onContextMenu={e => handleContextMenu(e, file)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium hover:bg-surface2 text-text2 hover:text-text cursor-pointer transition-colors group relative"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className="text-base flex-shrink-0">
                        {file.type === 'dir' ? '📁' : getFileIcon(file.name)}
                      </span>
                      <span className="truncate">{file.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {file.type === 'file' && <span className="text-[10px] text-muted">{fmtBytes(file.size)}</span>}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleContextMenu(e, file);
                        }}
                        className="p-1 rounded-lg hover:bg-border opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-3.5 h-3.5 text-muted" />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* File Text Editor */}
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-xl flex flex-col h-[520px] md:col-span-2">
          <div className="px-3 py-2 border-b border-border/80 flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted uppercase tracking-wider truncate mr-4">
              Editor: {selectedFile || 'No file selected'}
            </span>
            {selectedFile && (
              <div className="flex gap-2">
                <button
                  onClick={handleSaveFile}
                  className="bg-green-500 hover:bg-green-500/90 active:scale-95 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-lg shadow-green-500/10 transition-all flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  onClick={() => window.open(`/api/files/${selectedAppId}/download?path=${encodeURIComponent(selectedFile)}`)}
                  className="p-2 rounded-xl border border-border text-text2 hover:bg-surface2 hover:text-text transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleCtxAction('delete')}
                  className="p-2 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 relative">
            {fileLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-bg/50 backdrop-blur-xs rounded-xl">
                <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin"></div>
              </div>
            ) : null}
            <textarea
              value={fileContent}
              onChange={e => setFileContent(e.target.value)}
              placeholder="Select a text file to edit code directly..."
              className="w-full h-full bg-[#030307] border border-border/80 rounded-xl p-4 font-mono text-xs text-text2 outline-none focus:border-accent resize-none leading-relaxed"
            ></textarea>
          </div>
        </div>
      </div>

      {/* Floating Context Menu */}
      {ctxMenu && (
        <div
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          className="fixed z-[9999] min-w-[190px] bg-bg2 border border-border rounded-2xl p-2.5 shadow-2xl backdrop-blur-md"
        >
          <div onClick={() => handleCtxAction('rename')} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-text2 hover:bg-surface hover:text-text cursor-pointer transition-colors">✏️ Rename</div>
          <div onClick={() => handleCtxAction('move')} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-text2 hover:bg-surface hover:text-text cursor-pointer transition-colors">📂 Move to...</div>
          <div onClick={() => handleCtxAction('archive-zip')} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-text2 hover:bg-surface hover:text-text cursor-pointer transition-colors">🗜️ Archive as .zip</div>
          <div onClick={() => handleCtxAction('archive-targz')} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-text2 hover:bg-surface hover:text-text cursor-pointer transition-colors">🗜️ Archive as .tar.gz</div>
          {/\.(zip|tar\.gz|tgz)$/i.test(ctxMenu.targetFile.name) && (
            <div onClick={() => handleCtxAction('extract')} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-text2 hover:bg-surface hover:text-text cursor-pointer transition-colors">📦 Extract here</div>
          )}
          <div className="h-px bg-border my-1"></div>
          <div onClick={() => handleCtxAction('download')} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-text2 hover:bg-surface hover:text-text cursor-pointer transition-colors">⬇️ Download</div>
          <div className="h-px bg-border my-1"></div>
          <div onClick={() => handleCtxAction('delete')} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-danger hover:bg-danger/10 cursor-pointer transition-colors">🗑️ Delete</div>
        </div>
      )}
    </div>
  );
}
