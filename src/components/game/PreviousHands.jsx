import React from 'react';
import HandNotation from './HandNotation';

// R/B result colour — red text when the board went red, white when it went black
function rbColor(rb) {
  if (!rb || rb === '—') return '#888888';
  const token = String(rb).trim().split(/\s+/)[0] || '';
  if (token.endsWith('R')) return '#FF3B3B';
  return '#FFFFFF';
}

export default function PreviousHands({ history }) {
  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden h-full"
      style={{
        background: 'var(--theme-bg, #050d21)',
        border: '3px solid #e8b84b',
        boxShadow: '0 0 0 1px #000 inset, 0 0 8px rgba(232,184,75,0.3), 0 2px 8px rgba(0,0,0,0.6)',
        minHeight: 0
      }}
    >
      <div
        className="text-center py-2"
        style={{
          color: '#E5B64E',
          fontWeight: 800,
          fontSize: 13,
          letterSpacing: '1px',
          borderBottom: '1px solid #C5A059',
          background: 'var(--theme-bg, #050d21)'
        }}
      >
        PREVIOUS HANDS
      </div>
      <div
        className="grid grid-cols-3 px-3 text-center"
        style={{
          color: '#E5B64E',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.5px',
          paddingTop: 6,
          paddingBottom: 10,
          borderBottom: '1px solid rgba(197,160,89,0.3)'
        }}
      >
        <div className="text-left">HAND</div>
        <div>TYPE</div>
        <div>R/B L/H</div>
      </div>
      <div
        className="flex-1 overflow-y-auto no-scrollbar"
        style={{ minHeight: 0, paddingTop: 6, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {history.length === 0 && (
          <div className="text-center py-6 text-xs" style={{ color: '#5a678a', opacity: 0.5 }}>
            No hands yet
          </div>
        )}
        {history.map((h, i) => (
          <div
            key={i}
            className="grid grid-cols-3 px-3 py-1.5 text-center items-center"
            style={{
              background: i % 2 === 0 ? 'var(--theme-strip, rgba(4,18,43,0.7))' : 'transparent',
              fontSize: 11,
              borderBottom: '1px solid rgba(197,160,89,0.08)'
            }}
          >
            <div className="text-left">
              <HandNotation cards={h.handCards} />
              {h.hand === 'FOLD' && <span style={{ color: '#888' }}>FOLD</span>}
              {h.hand === 'BOARD' && <span className="text-white">BOARD</span>}
            </div>
            <div style={{ color: h.color, fontWeight: 700 }}>{h.type}</div>
            <div style={{ color: rbColor(h.rb), fontWeight: 700 }}>{h.rb}</div>
          </div>
        ))}
      </div>
    </div>
  );
}