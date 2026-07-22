import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function MaskedIP({ ip }) {
  const [isRevealed, setIsRevealed] = useState(false);

  if (!ip) return <span className="text-muted font-mono text-xs">N/A</span>;

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsRevealed(prev => !prev);
  };

  return (
    <span
      onClick={handleToggle}
      onMouseEnter={() => setIsRevealed(true)}
      onMouseLeave={() => setIsRevealed(false)}
      className="inline-flex items-center gap-1.5 font-mono text-xs cursor-pointer select-none px-2 py-0.5 rounded bg-bg border border-border/80 transition-all hover:border-accent"
      title="Hover or click to toggle IP visibility"
    >
      <span className={`transition-all duration-300 ${
        isRevealed ? 'filter-none text-accent font-bold' : 'blur-[4px] text-muted opacity-60'
      }`}>
        {ip}
      </span>
      {isRevealed ? (
        <Eye className="w-3 h-3 text-accent transition-opacity" />
      ) : (
        <EyeOff className="w-3 h-3 text-muted transition-opacity opacity-70" />
      )}
    </span>
  );
}
