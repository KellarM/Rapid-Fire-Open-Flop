import React from 'react';
import HandNotation from '@/components/game/HandNotation';

export default function PreviousHandRow({ hand, index }) {
  const [rb = '—', lh = '—'] = String(hand.rb || '—').trim().split(/\s+/);
  const resultColor = rb === '—' ? '#888888' : rb.endsWith('R') ? '#FF3B3B' : '#FFFFFF';

  return (
    <tr
      className="text-center align-middle text-[11px]"
      style={{
        background: index % 2 === 0 ? 'var(--theme-strip, rgba(4,18,43,0.7))' : 'transparent',
        borderBottom: '1px solid rgba(197,160,89,0.08)'
      }}
    >
      <td className="px-1 py-2.5 whitespace-nowrap">
        <HandNotation cards={hand.handCards} />
        {hand.hand === 'FOLD' && <span style={{ color: '#888' }}>FOLD</span>}
        {hand.hand === 'BOARD' && <span className="text-white">BOARD</span>}
      </td>
      <td className="px-1 py-2.5 whitespace-nowrap font-bold" style={{ color: hand.color }}>{hand.type}</td>
      <td className="px-1 py-2.5 whitespace-nowrap font-bold" style={{ color: resultColor }}>{rb}</td>
      <td className="px-1 py-2.5 whitespace-nowrap font-bold" style={{ color: resultColor }}>{lh}</td>
    </tr>
  );
}