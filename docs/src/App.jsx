import React, { useState, useEffect } from 'react';
import { DOCS_SECTIONS } from './docsData';
import { 
  BookOpen, 
  Terminal, 
  Menu, 
  X, 
  Copy, 
  Check, 
  Search, 
  ChevronRight, 
  Cpu 
} from 'lucide-react';

const GithubIcon = (props) => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
  </svg>
);

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
    <div className="min-h-screen bg-[#0b0c10] text-[#9ca3af] flex flex-col font-sans selection:bg-purple-500/30 selection:text-white">
      
      {/* Header / Top Navigation Bar */}
      <header className="sticky top-0 z-40 h-16 bg-[#0b0c10]/95 backdrop-blur border-b border-white/5 flex items-center justify-between px-6 shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 hover:bg-white/5 rounded-xl text-white transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-white text-base tracking-tight font-heading">Orbiton Docs</span>
            <span className="bg-purple-500/10 text-purple-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-purple-500/15">v1.13.1</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <a 
            href="https://github.com/iamprmgvyt/orbiton" 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center gap-1.5 hover:text-white text-sm font-semibold transition-colors"
          >
            <GithubIcon className="w-4.5 h-4.5" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 flex w-full max-w-[1400px] mx-auto px-4 md:px-8 gap-8 relative">
        
        {/* Left Sidebar Menu */}
        <aside className={`
          fixed md:sticky top-16 md:top-24 z-30 w-72 h-[calc(100vh-4rem)] md:h-[calc(100vh-6rem)] overflow-y-auto pr-4 border-r border-white/5 bg-[#0b0c10] md:bg-transparent
          transition-transform duration-300 md:translate-x-0 
          ${sidebarOpen ? 'translate-x-0 left-0 p-6 w-80' : '-translate-x-full md:block'}
        `}>
          
          {/* Search bar inside sidebar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#12131a] border border-white/5 focus:border-purple-500/50 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-all shadow-inner"
            />
          </div>

          {searchQuery ? (
            // Search Results
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Search Results</span>
              {filteredSections.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    selectSection(s.id);
                    setSearchQuery('');
                  }}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-semibold block transition-all ${
                    activeSectionId === s.id
                      ? 'bg-purple-500/10 border-purple-500/20 text-purple-400 shadow'
                      : 'bg-transparent border-transparent hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {s.title}
                </button>
              ))}
              {filteredSections.length === 0 && (
                <span className="text-xs text-gray-500 italic block p-2">No matching topics found.</span>
              )}
            </div>
          ) : (
            // Sidebar Navigation Tree
            <nav className="space-y-6">
              {Object.entries(categories).map(([cat, items]) => (
                <div key={cat} className="space-y-1">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-2">{cat}</h4>
                  {items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => selectSection(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                        activeSectionId === item.id
                          ? 'bg-purple-500/15 text-purple-400 shadow border border-purple-500/10'
                          : 'bg-transparent text-[#9ca3af] hover:bg-white/[0.03] hover:text-white border border-transparent'
                      }`}
                    >
                      {item.title}
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeSectionId === item.id ? 'translate-x-0.5 text-purple-400' : 'text-gray-600'}`} />
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          )}
        </aside>

        {/* Center Main Article Content */}
        <article className="flex-1 min-w-0 py-8 md:py-12 space-y-6 max-w-3xl">
          
          {parsedElements.map((el, i) => {
            if (el.type === 'h1') {
              return <h1 key={i} className="text-3xl sm:text-4xl font-extrabold text-white font-heading tracking-tight mb-6">{el.text}</h1>;
            }
            if (el.type === 'h2') {
              // Add HTML id tag for navigation anchors
              const id = el.text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              return <h2 id={id} key={i} className="text-xl sm:text-2xl font-bold text-white font-heading mt-8 mb-4 border-b border-white/5 pb-2">{el.text}</h2>;
            }
            if (el.type === 'h3') {
              const id = el.text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              return <h3 id={id} key={i} className="text-base sm:text-lg font-bold text-white font-heading mt-6 mb-3">{el.text}</h3>;
            }
            if (el.type === 'hr') {
              return <hr key={i} className="border-white/5 my-8" />;
            }
            if (el.type === 'bullet') {
              return (
                <ul key={i} className="list-disc list-inside pl-4 text-sm leading-relaxed text-gray-300">
                  <li className="mb-2">{renderInlineText(el.text)}</li>
                </ul>
              );
            }
            if (el.type === 'codeblock') {
              const blockId = `block_${i}`;
              return (
                <div key={i} className="relative group my-6 rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
                  {/* Top Bar for Code Block */}
                  <div className="bg-[#07080b] px-4 py-2 flex items-center justify-between border-b border-white/5 text-[10px] text-gray-500 font-mono">
                    <span>{el.lang.toUpperCase()}</span>
                    <button
                      onClick={() => handleCopy(el.content, blockId)}
                      className="flex items-center gap-1.5 hover:text-white transition-colors py-1 px-2 rounded-lg bg-white/5"
                    >
                      {copiedId === blockId ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === blockId ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="m-0 bg-[#030305] p-5 overflow-x-auto font-mono text-xs">
                    <code className="text-[#34d399] leading-relaxed block">{el.content}</code>
                  </pre>
                </div>
              );
            }
            // Paragraph
            return <p key={i} className="text-sm sm:text-base leading-relaxed text-gray-300 mb-4">{renderInlineText(el.text)}</p>;
          })}

        </article>

        {/* Right Table of Contents (On this page) - Hidden on smaller screens */}
        <aside className="hidden lg:block w-64 shrink-0 py-12 sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto pl-4 border-l border-white/5">
          {tocElements.length > 0 && (
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">On this page</span>
              <ul className="space-y-2 list-none m-0 p-0 text-xs">
                {tocElements.map((el, i) => {
                  const href = `#${el.text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                  return (
                    <li key={i} className={`m-0 ${el.type === 'h3' ? 'pl-4' : ''}`}>
                      <a 
                        href={href}
                        className="text-gray-500 hover:text-white transition-colors duration-150 py-0.5 block"
                      >
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
