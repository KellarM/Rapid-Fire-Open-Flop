import React from 'react';
import PreviousHandRow from '@/components/game/PreviousHandRow';

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
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <table className="w-full table-fixed border-collapse" aria-label="Previous hands">
          <colgroup>
            <col style={{ width: '32%' }} />
            <col style={{ width: '32%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead>
            <tr style={{ color: '#E5B64E', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px' }}>
              {['HAND', 'TYPE', 'R/B', 'L/H'].map(label => (
                <th key={label} scope="col" className="sticky top-0 z-10 px-1 pt-3 pb-3 text-center whitespace-nowrap" style={{ background: 'var(--theme-bg, #050d21)', borderBottom: '1px solid rgba(197,160,89,0.3)' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr aria-hidden="true"><td colSpan={4} className="h-5 p-0" /></tr>
            {history.length === 0 && (
              <tr><td colSpan={4} className="text-center py-6 text-xs" style={{ color: '#5a678a', opacity: 0.5 }}>No hands yet</td></tr>
            )}
            {history.map((hand, index) => <PreviousHandRow key={index} hand={hand} index={index} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}