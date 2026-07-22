import React from 'react';
import { useTranslation } from '../utils/i18n';
import { Globe } from 'lucide-react';

export default function LanguageSelector() {
  const { lang, setLanguage } = useTranslation();

  const languages = [
    { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'es', label: 'Español', flag: '🇪🇸' }
  ];

  return (
    <div className="language-selector-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <Globe size={16} style={{ color: 'var(--text-muted)' }} />
      <select 
        value={lang} 
        onChange={(e) => setLanguage(e.target.value)}
        className="form-control language-select-dropdown"
        style={{ 
          padding: '4px 8px', 
          fontSize: '12px', 
          borderRadius: '6px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'var(--text-primary)',
          cursor: 'pointer'
        }}
      >
        {languages.map(l => (
          <option key={l.code} value={l.code} style={{ background: '#111827', color: '#fff' }}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
