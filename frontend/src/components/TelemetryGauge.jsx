import React from 'react';

export default function TelemetryGauge({ percentage = 0, label = '', valueText = '', size = 110, strokeWidth = 8 }) {
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  let strokeColor = '#10b981'; // Green
  if (clamped > 85) {
    strokeColor = '#ef4444'; // Red
  } else if (clamped > 60) {
    strokeColor = '#f59e0b'; // Amber
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '8px' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background Track Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
          />
        </svg>
        {/* Center Label */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
            {valueText || `${Math.round(clamped)}%`}
          </span>
        </div>
      </div>
      {label && (
        <span style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
          {label}
        </span>
      )}
    </div>
  );
}
