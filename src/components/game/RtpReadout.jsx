import React from 'react';

// Justification readout for the RTP tool: for each board, the operator's
// target next to the true expected return over all 406 turn/river completions,
// then a position-by-position line pairing the odds on offer with the odds
// that would hit the target.

const GOLD = '#e5c158';
const GREEN = '#4ade80';
const RED = '#f87171';
const MUTED = '#8a8a8a';
const BODY = '#c4b896';

const GRID = '1.25fr 0.85fr 0.85fr 24px';

function pct(v) { return v == null ? '—' : `${(v * 100).toFixed(2)}%`; }
function odds(v) { return v == null || !isFinite(v) ? '—' : `${v.toFixed(2)}:1`; }

function BoardBlock({ title, targetPct, rows, trueReturn }) {
  const ok = trueReturn != null && Math.abs(trueReturn - targetPct / 100) <= 0.001;
  return (
    <div style={{
      border: '1px solid rgba(197,160,89,0.25)',
      borderRadius: 10,
      overflow: 'hidden',
      background: 'rgba(0,0,0,0.3)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px', background: 'rgba(202,138,4,0.08)',
        borderBottom: '1px solid rgba(197,160,89,0.2)',
      }}>
        <span style={{ color: GOLD, fontSize: 11, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {title}
        </span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <span style={{ color: MUTED, fontSize: 10 }}>
            Target <b style={{ color: BODY }}>{targetPct.toFixed(2)}%</b>
          </span>
          <span style={{ color: ok ? GREEN : RED, fontSize: 12, fontWeight: 900 }}>
            {pct(trueReturn)}
          </span>
        </span>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: GRID, gap: 4,
        padding: '6px 12px 3px', fontSize: 9, fontWeight: 800,
        color: 'rgba(197,160,89,0.6)', letterSpacing: '0.06em', textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <span>Position</span>
        <span style={{ textAlign: 'right' }}>Offered</span>
        <span style={{ textAlign: 'right' }}>At Target</span>
        <span />
      </div>

      <div style={{ maxHeight: 172, overflowY: 'auto' }}>
        {rows.map(r => (
          <div key={r.key} style={{
            display: 'grid', gridTemplateColumns: GRID, gap: 4,
            padding: '5px 12px', fontSize: 10, color: BODY, alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            opacity: r.locked ? 0.4 : 1,
          }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r.label}
            </span>
            <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{odds(r.offered)}</span>
            <span style={{ textAlign: 'right', fontFamily: 'monospace', color: GOLD }}>{odds(r.preview)}</span>
            <span style={{ textAlign: 'center', color: r.ok ? GREEN : RED, fontWeight: 900 }}>
              {r.ok == null ? '' : r.ok ? '✓' : '✕'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RtpReadout({ card, rank, cardTarget, rankTarget }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ color: GOLD, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Live Justification
        </span>
        <span style={{ color: MUTED, fontSize: 10 }}>
          {card.total} turn/river runouts · board wins {pct(card.boardWinProb)}
        </span>
      </div>

      <BoardBlock
        title="Card Board"
        targetPct={cardTarget}
        rows={card.rows}
        trueReturn={card.trueReturn}
      />
      <BoardBlock
        title="Rank Board"
        targetPct={rankTarget}
        rows={rank.rows}
        trueReturn={rank.trueReturn}
      />

      <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.5 }}>
        “At Target” is the odds that would return the target on that position.
        The bold percentage is each board's true expected return across every
        turn/river completion, so tied-hand payouts and rounds where the board
        beats all hands are included. Locked positions are shown dimmed and are
        not judged.
      </div>
    </div>
  );
}