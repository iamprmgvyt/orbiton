import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Check } from 'lucide-react';

export default function FilePreviewDrawer({ isOpen, file, content = '', onSave, onClose }) {
  const [fileContent, setFileContent] = useState(content);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setFileContent(content);
    setSavedSuccess(false);
  }, [content, file]);

  if (!isOpen || !file) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(file.path, fileContent);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="file-preview-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9998,
        display: 'flex',
        justifyContent: 'flex-end'
      }}
    >
      <div 
        className="file-preview-drawer"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '650px',
          height: '100%',
          background: '#0f172a',
          borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} style={{ color: '#38bdf8' }} />
            <div>
              <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '14px' }}>{file.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{file.path}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {savedSuccess ? <Check size={14} /> : <Save size={14} />}
              {savedSuccess ? 'Saved!' : (saving ? 'Saving...' : 'Save File')}
            </button>
            <button 
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Drawer Body (Code Textarea) */}
        <div style={{ flex: 1, padding: '12px', background: '#020617' }}>
          <textarea 
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            spellCheck="false"
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#38bdf8',
              fontFamily: 'monospace, Consolas, "Courier New"',
              fontSize: '13px',
              lineHeight: '1.6',
              resize: 'none'
            }}
          />
        </div>
      </div>
    </div>
  );
}
