import React, { useState, useEffect } from 'react';
import { RotateCw, ShieldCheck } from 'lucide-react';

export default function Captcha({ onCaptchaChange }) {
  const [captchaCode, setCaptchaCode] = useState('');
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [answer, setAnswer] = useState(0);

  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 20) + 1;
    const n2 = Math.floor(Math.random() * 20) + 1;
    const ans = n1 + n2;
    setNum1(n1);
    setNum2(n2);
    setAnswer(ans);
    setCaptchaCode(`${n1} + ${n2} = ?`);
    if (onCaptchaChange) {
      onCaptchaChange(ans.toString());
    }
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-accent" />
          Anti-Bot Verification (CAPTCHA)
        </label>
        <button
          type="button"
          onClick={generateCaptcha}
          className="text-[11px] text-accent hover:underline flex items-center gap-1 font-semibold"
          title="Regenerate CAPTCHA"
        >
          <RotateCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Distorted Anti-Bot SVG Banner */}
        <div className="relative flex-1 bg-surface2 border border-border/80 rounded-xl overflow-hidden py-2.5 px-4 flex items-center justify-center select-none shadow-inner">
          <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="10" x2="100%" y2="30" stroke="#6366f1" strokeWidth="2" strokeDasharray="5,5" />
            <line x1="10%" y1="40" x2="90%" y2="10" stroke="#ec4899" strokeWidth="1.5" />
            <circle cx="20%" cy="50%" r="15" fill="none" stroke="#10b981" strokeWidth="1" />
            <circle cx="80%" cy="30%" r="8" fill="none" stroke="#eab308" strokeWidth="1" />
          </svg>
          <span className="font-mono text-xl font-extrabold text-text tracking-widest skew-x-6 rotate-[-2deg] drop-shadow-md">
            {captchaCode}
          </span>
        </div>
      </div>
    </div>
  );
}
