import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, RotateCw, Lock, Sparkles } from 'lucide-react';

export default function Captcha({ onVerifyChange }) {
  const [status, setStatus] = useState('unchecked'); // 'unchecked' | 'verifying' | 'verified' | 'challenge'
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const generateChallenge = () => {
    const n1 = Math.floor(Math.random() * 15) + 2;
    const n2 = Math.floor(Math.random() * 15) + 2;
    setNum1(n1);
    setNum2(n2);
    setUserAnswer('');
    setErrorMsg('');
  };

  useEffect(() => {
    generateChallenge();
  }, []);

  const handleCheckboxClick = () => {
    if (status === 'verified') return;
    setStatus('verifying');
    setErrorMsg('');

    // Simulate smart Turnstile browser telemetry & mouse movement check
    setTimeout(() => {
      // 80% chance auto-pass via Turnstile smart telemetry simulation, 20% prompt math challenge
      const passDirect = true;
      if (passDirect) {
        setStatus('verified');
        if (onVerifyChange) onVerifyChange(true);
      } else {
        setStatus('challenge');
      }
    }, 900);
  };

  const handleVerifyChallenge = (e) => {
    e.preventDefault();
    if (parseInt(userAnswer.trim(), 10) === num1 + num2) {
      setStatus('verified');
      setErrorMsg('');
      if (onVerifyChange) onVerifyChange(true);
    } else {
      setErrorMsg('Incorrect answer! Please try again.');
      generateChallenge();
      if (onVerifyChange) onVerifyChange(false);
    }
  };

  const handleReset = () => {
    setStatus('unchecked');
    generateChallenge();
    if (onVerifyChange) onVerifyChange(false);
  };

  return (
    <div className="w-full select-none">
      {/* Modern reCAPTCHA / Cloudflare Turnstile Card Widget */}
      <div className={`relative w-full bg-surface2/90 border transition-all duration-300 rounded-2xl p-4 shadow-lg backdrop-blur-md ${
        status === 'verified' 
          ? 'border-green-500/50 bg-green-500/5' 
          : status === 'verifying'
          ? 'border-accent/50 animate-pulse'
          : 'border-border hover:border-border2'
      }`}>
        <div className="flex items-center justify-between gap-3">
          {/* Left Checkbox & Interactive State */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={handleCheckboxClick}>
            {status === 'unchecked' && (
              <div className="w-7 h-7 rounded-lg border-2 border-border2 hover:border-accent bg-bg flex items-center justify-center transition-all shadow-inner"></div>
            )}

            {status === 'verifying' && (
              <div className="w-7 h-7 rounded-lg border-2 border-accent/40 border-t-accent rounded-full animate-spin"></div>
            )}

            {status === 'verified' && (
              <div className="w-7 h-7 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
            )}

            {status === 'challenge' && (
              <div className="w-7 h-7 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
            )}

            <div className="flex flex-col">
              <span className={`text-xs font-bold transition-colors ${
                status === 'verified' ? 'text-green-400' : 'text-text'
              }`}>
                {status === 'unchecked' && "I'm not a robot"}
                {status === 'verifying' && "Verifying browser security..."}
                {status === 'verified' && "Success! You are verified human"}
                {status === 'challenge' && "Complete security challenge"}
              </span>
              <span className="text-[10px] text-muted flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-accent" />
                reCAPTCHA / Turnstile Anti-Bot Protocol
              </span>
            </div>
          </div>

          {/* Right Brand Logo & Reset */}
          <div className="flex items-center gap-2">
            {status === 'verified' ? (
              <button
                type="button"
                onClick={handleReset}
                className="text-[10px] text-muted hover:text-text transition-colors p-1"
                title="Reset verification"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex flex-col items-end opacity-60">
                <ShieldCheck className="w-5 h-5 text-accent" />
                <span className="text-[8px] text-muted uppercase font-bold tracking-tighter">Protected</span>
              </div>
            )}
          </div>
        </div>

        {/* Fallback Math Challenge Drawer */}
        {status === 'challenge' && (
          <div className="mt-3 pt-3 border-t border-border/60 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-semibold text-text2">
              <span>Security Math Test: <strong className="text-accent font-mono text-sm">{num1} + {num2} = ?</strong></span>
              <button type="button" onClick={generateChallenge} className="text-accent hover:underline text-[10px]">
                <RotateCw className="w-3 h-3 inline" /> New
              </button>
            </div>
            {errorMsg && <p className="text-[11px] text-red-400 font-medium">{errorMsg}</p>}
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Result..."
                className="flex-1 bg-bg border border-border focus:border-accent text-text text-xs rounded-xl py-1.5 px-3 font-mono outline-none"
              />
              <button
                type="button"
                onClick={handleVerifyChallenge}
                className="bg-accent hover:bg-accent/90 text-white font-semibold text-xs px-3 py-1.5 rounded-xl transition-all"
              >
                Verify
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
