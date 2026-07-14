import React, { useState, useEffect } from 'react';
import { DOCS_SECTIONS } from './docsData';
import { supabase } from './utils/supabaseClient';
import { 
  Menu, 
  X, 
  Copy, 
  Check, 
  Search, 
  ChevronRight, 
  Cpu,
  Terminal,
  Activity,
  FolderOpen,
  Settings
} from 'lucide-react';

const GithubIcon = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
  </svg>
);

function FeedbackForm() {
  const [rating, setRating] = useState(5);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [allFeedbacks, setAllFeedbacks] = useState([]);

  const PANEL_API_URL = import.meta.env.VITE_PANEL_API_URL || '';

  const loadFeedbacks = async () => {
    try {
      if (PANEL_API_URL) {
        const res = await fetch(`${PANEL_API_URL}/feedbacks`);
        if (!res.ok) throw new Error('Failed to fetch from Panel API');
        const data = await res.json();
        setAllFeedbacks(data || []);
        return;
      }
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAllFeedbacks(data || []);
    } catch (err) {
      console.warn('Query failed. Falling back to localStorage:', err.message);
      const list = JSON.parse(localStorage.getItem('orbiton_feedbacks') || '[]');
      setAllFeedbacks(list);
    }
  };

  useEffect(() => {
    loadFeedbacks();
  }, [submitted]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !message) return alert('Name and review content are required.');
    
    const newFeedback = { name, email, rating, message };
    
    try {
      const { error } = await supabase.from('feedbacks').insert([newFeedback]);
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      console.warn('Save failed. Saving to localStorage:', err.message);
      const list = JSON.parse(localStorage.getItem('orbiton_feedbacks') || '[]');
      list.unshift({ ...newFeedback, date: new Date().toLocaleDateString() });
      localStorage.setItem('orbiton_feedbacks', JSON.stringify(list));
      setSubmitted(true);
    }

    setName('');
    setEmail('');
    setMessage('');
    setRating(5);
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="feedback-section-container">
      {submitted && (
        <div className="feedback-success">
          <h4>🎉 Your review has been submitted successfully!</h4>
          <p>Thank you for your valuable contribution to the development of Orbiton.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="feedback-form">
        <h3 className="feedback-form-title">Submit Feedback & Reviews</h3>
        <p className="feedback-form-subtitle">We always appreciate your thoughts and suggestions to improve Orbiton every day.</p>
        
        <div className="star-rating-wrapper">
          <span className="rating-label">Satisfaction Level:</span>
          <div className="star-rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                onClick={() => setRating(star)}
                className={`star-icon ${star <= rating ? 'active' : ''}`}
              >
                ★
              </span>
            ))}
          </div>
        </div>

        <div className="feedback-input-grid">
          <div>
            <label className="feedback-input-label">Your Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="feedback-input-field"
            />
          </div>
          <div>
            <label className="feedback-input-label">Email (Optional)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. name@example.com"
              className="feedback-input-field"
            />
          </div>
        </div>

        <div>
          <label className="feedback-input-label">Your Review / Feedback</label>
          <textarea
            rows="4"
            required
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Orbiton runs smoothly, the interface is gorgeous! I would like to suggest..."
            className="feedback-textarea-field"
          ></textarea>
        </div>

        <button type="submit" className="feedback-submit-btn">
          Submit Review & Feedback
        </button>
      </form>

      {/* Community Feedbacks List */}
      {allFeedbacks.length > 0 && (
        <div className="community-reviews-list">
          <h4 className="reviews-list-title">Community Reviews ({allFeedbacks.length})</h4>
          <div className="reviews-cards-grid">
            {allFeedbacks.map((f, idx) => (
              <div key={idx} className="review-card">
                <div className="review-card-header">
                  <span className="review-author">{f.name}</span>
                  <span className="review-date">{f.created_at ? new Date(f.created_at).toLocaleDateString() : (f.date || 'N/A')}</span>
                </div>
                <div className="review-stars-static">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`star-static-icon ${i < f.rating ? 'active' : ''}`}>★</span>
                  ))}
                </div>
                <p className="review-content">"{f.message}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [activeSectionId, setActiveSectionId] = useState('intro');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const activeSection = DOCS_SECTIONS.find(s => s.id === activeSectionId) || DOCS_SECTIONS[0];

  // Group sections by category for sidebar navigation
  const categories = DOCS_SECTIONS.reduce((groups, section) => {
    const cat = section.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(section);
    return groups;
  }, {});

  // Handle URL hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash && DOCS_SECTIONS.some(s => s.id === hash)) {
        setActiveSectionId(hash);
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const selectSection = (id) => {
    setActiveSectionId(id);
    window.location.hash = id;
    setSidebarOpen(false);
  };

  const handleCopy = (text, blockId) => {
    navigator.clipboard.writeText(text);
    setCopiedId(blockId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Basic Markdown Parser to HTML Elements
  const parseMarkdown = (markdown) => {
    if (!markdown) return [];
    
    const lines = markdown.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeContent = [];
    let codeLang = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          elements.push({
            type: 'codeblock',
            lang: codeLang,
            content: codeContent.join('\n')
          });
          codeContent = [];
        } else {
          inCodeBlock = true;
          codeLang = line.trim().replace('```', '') || 'text';
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      if (line.startsWith('# ')) {
        elements.push({ type: 'h1', text: line.replace('# ', '') });
        continue;
      }
      if (line.startsWith('## ')) {
        elements.push({ type: 'h2', text: line.replace('## ', '') });
        continue;
      }
      if (line.startsWith('### ')) {
        elements.push({ type: 'h3', text: line.replace('### ', '') });
        continue;
      }

      if (line.trim() === '---') {
        elements.push({ type: 'hr' });
        continue;
      }

      if (line.trim().startsWith('* ')) {
        elements.push({ type: 'bullet', text: line.trim().replace('* ', '') });
        continue;
      }

      if (line.trim() === '') {
        continue;
      }

      elements.push({ type: 'p', text: line });
    }

    return elements;
  };

  // Automated simple syntax highlighting for code blocks
  const highlightCode = (code) => {
    if (!code) return '';
    let html = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Match comments
    html = html.replace(/(\/\/.*|#.*)/g, '<span class="hl-comment">$1</span>');

    // Match JSON keys & string values
    html = html.replace(/(".*?")/g, '<span class="hl-string">$1</span>');

    // Match numbers
    html = html.replace(/\b(\d+)\b/g, '<span class="hl-number">$1</span>');

    // Match HTTP Methods
    html = html.replace(/\b(POST|GET|PUT|DELETE)\b/g, '<span class="hl-method">$1</span>');

    // Match Bash / CLI commands
    html = html.replace(/\b(sudo|bash|curl|chmod|node|npm|git|install|mkdir|cd|rm)\b/g, '<span class="hl-keyword">$1</span>');

    return html;
  };

  const renderInlineText = (text) => {
    const html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const parsedElements = parseMarkdown(activeSection.content);
  
  // Extract table of contents (H2 / H3 elements) for the right column ToC
  const tocElements = parsedElements.filter(el => el.type === 'h2' || el.type === 'h3');

  // Filter sections for search utility
  const filteredSections = DOCS_SECTIONS.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="docs-app">
      
      {/* Header / Top Navigation Bar */}
      <header className="docs-header">
        <div className="header-brand">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="btn-toggle-sidebar"
            aria-label="Toggle navigation menu"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="brand-icon-wrapper">
            <Cpu size={20} />
          </div>
          <span className="brand-name">Orbiton Docs</span>
          <span className="brand-badge">v1.13.1</span>
        </div>

        <div className="header-actions">
          <a 
            href="https://github.com/iamprmgvyt/orbiton" 
            target="_blank" 
            rel="noreferrer"
            className="btn-github"
          >
            <GithubIcon />
            <span>GitHub</span>
          </a>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="docs-container">
        
        {/* Left Sidebar Menu */}
        <aside className={`docs-sidebar ${sidebarOpen ? 'open' : ''}`}>
          
          {/* Search bar inside sidebar */}
          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {searchQuery ? (
            // Search Results
            <div className="nav-category">
              <h4 className="nav-category-title">Search Results</h4>
              {filteredSections.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    selectSection(s.id);
                    setSearchQuery('');
                  }}
                  className={`nav-item ${activeSectionId === s.id ? 'active' : ''}`}
                >
                  {s.title}
                </button>
              ))}
              {filteredSections.length === 0 && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', padding: '8px 12px' }}>
                  No matching topics found.
                </span>
              )}
            </div>
          ) : (
            // Sidebar Navigation Tree
            <nav>
              {Object.entries(categories).map(([cat, items]) => (
                <div key={cat} className="nav-category">
                  <h4 className="nav-category-title">{cat}</h4>
                  {items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => selectSection(item.id)}
                      className={`nav-item ${activeSectionId === item.id ? 'active' : ''}`}
                    >
                      {item.title}
                      <ChevronRight size={14} style={{ opacity: activeSectionId === item.id ? 1 : 0.3 }} />
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          )}
        </aside>

        {/* Center Main Article Content */}
        <main className="docs-content">
          {parsedElements.map((el, i) => {
            if (el.type === 'h1') {
              return <h1 key={i}>{el.text}</h1>;
            }
            if (el.type === 'h2') {
              const id = el.text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              return <h2 id={id} key={i}>{el.text}</h2>;
            }
            if (el.type === 'h3') {
              const id = el.text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              return <h3 id={id} key={i}>{el.text}</h3>;
            }
            if (el.type === 'hr') {
              return <hr key={i} />;
            }
            if (el.type === 'bullet') {
              return (
                <ul key={i}>
                  <li>{renderInlineText(el.text)}</li>
                </ul>
              );
            }
            if (el.type === 'codeblock') {
              const blockId = `block_${i}`;
              return (
                <div key={i} className="code-block-wrapper">
                  <div className="code-block-header">
                    <span>{el.lang}</span>
                    <button
                      onClick={() => handleCopy(el.content, blockId)}
                      className="btn-copy"
                    >
                      {copiedId === blockId ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                      {copiedId === blockId ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="code-block-pre">
                    <code dangerouslySetInnerHTML={{ __html: highlightCode(el.content) }} />
                  </pre>
                </div>
              );
            }
            // Paragraph
            return <p key={i}>{renderInlineText(el.text)}</p>;
          })}

          {/* Interactive Feature Grid - Only for Introduction section */}
          {activeSectionId === 'intro' && (
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon-wrapper">
                  <Terminal size={18} />
                </div>
                <h5 className="feature-title">App Orchestrator</h5>
                <p className="feature-desc">Control compile processes (Start, Stop, Restart) and manage application dependencies dynamically.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon-wrapper">
                  <Cpu size={18} />
                </div>
                <h5 className="feature-title">Multi-Node Cluster</h5>
                <p className="feature-desc">Decoupled systemd Wings equivalent agents connecting hundreds of remote host nodes securely.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon-wrapper">
                  <FolderOpen size={18} />
                </div>
                <h5 className="feature-title">Embedded File Manager</h5>
                <p className="feature-desc">Integrated web explorer to edit code, manage files, zip/unzip projects directly from the browser.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon-wrapper">
                  <Settings size={18} />
                </div>
                <h5 className="feature-title">Runtime Shop</h5>
                <p className="feature-desc">1-Click installation or uninstalling of Node, Python, Java, Docker, Rust, and compiler binaries.</p>
              </div>
            </div>
          )}
          
          {activeSectionId === 'feedback' && <FeedbackForm />}
        </main>

        {/* Right Table of Contents (On this page) */}
        <aside className="docs-toc">
          {tocElements.length > 0 && (
            <div>
              <h4 className="toc-title">On this page</h4>
              <ul className="toc-list">
                {tocElements.map((el, i) => {
                  const href = `#${el.text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                  return (
                    <li key={i} className={`toc-item ${el.type === 'h3' ? 'h3' : ''}`}>
                      <a href={href} className="toc-link">
                        {el.text}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>

      </div>
    </div>
  );
}
