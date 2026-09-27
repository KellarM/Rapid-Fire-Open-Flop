import React from 'react';

// Small green check / red cross badge marking whether a betting position's
// odds return the operator's target RTP. Sits top-left so it never collides
// with the WIN badge (top-right) or the padlock (centre).
export default function RtpBadge({ check, size = 14 }) {
  if (!check) return null;
  const ok = check.ok === true;
  return (
    <span
      title={`Return ${(check.rtp * 100).toFixed(2)}% — ${ok ? 'matches target' : 'off target'}`}
      style={{
        position: 'absolute',
        top: 2,
        left: 3,
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: ok
          ? 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)'
          : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
        color: '#fff',
        fontSize: size * 0.72,
        fontWeight: 900,
        lineHeight: 1,
        border: `1px solid ${ok ? '#4ade80' : '#fca5a5'}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.8)',
        pointerEvents: 'none',
        zIndex: 25,
      }}
    >
      {ok ? '✓' : '✕'}
    </span>
  );
}