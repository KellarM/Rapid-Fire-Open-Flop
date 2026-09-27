import React, { useEffect, useRef } from 'react';
import PlayingCard from './PlayingCard';
import { FIXED_HANDS, formatPayout } from '@/lib/game/cards';
import Chip from '@/components/game/Chip';
import RtpBadge from '@/components/game/RtpBadge';

// ── Inject keyframe animations once into the document head ──────────────────
const STYLE_ID = 'rf-card-board-animations';
function injectStyles() {
  if (typeof document === 'undefined') return;
  // Always (re)write textContent instead of bailing when the tag already
  // exists — a stale tag left over from a hot-reload / previous session
  // would otherwise keep OLD keyframes, silently dropping any new
  // animations added in a later code push.
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `
    @keyframes rf-leader-pulse {
      0%, 100% { transform: scale(1); }
      50%      { transform: scale(1.02); }
    }
    @keyframes rf-winner-settle {
      0%   { box-shadow: 0 0 24px 10px rgba(255,215,0,0.8); }
      100% { box-shadow: 0 0 10px 3px  rgba(255,215,0,0.3); }
    }
    @keyframes rf-bonus-pulse {
      0%   { box-shadow: 0 0 14px 4px rgba(255,215,0,0.6), inset 0 0 22px rgba(255,215,0,0.22); transform: scale(1.0);  border-color: rgba(255,215,0,0.5); }
      50%  { box-shadow: 0 0 42px 16px rgba(255,235,0,1.0), inset 0 0 50px rgba(255,235,0,0.45); transform: scale(1.14); border-color: #FFD700; }
      100% { box-shadow: 0 0 14px 4px rgba(255,215,0,0.6), inset 0 0 22px rgba(255,215,0,0.22); transform: scale(1.0);  border-color: rgba(255,215,0,0.5); }
    }
    /* EXPLODE — winning position pops with an elastic overshoot then
       settles back to its regular size, with a brightness flash on impact */
    @keyframes rf-bonus-explode {
      0%   { box-shadow: 0 0 12px 4px rgba(232,184,75,0.6), inset 0 0 16px rgba(232,184,75,0.15); transform: scale(1.0); filter: brightness(1.0); }
      100% { box-shadow: 0 0 24px 8px rgba(232,184,75,0.9), inset 0 0 30px rgba(232,184,75,0.25); transform: scale(1.0); filter: brightness(1.0); }
    }
    /* Bright flashbulb burst — accompanies the explode on winning positions */
    @keyframes rf-bonus-flash {
      0%   { opacity: 1;    transform: translate(-50%, -50%) scale(0.3); }
      100% { opacity: 0;    transform: translate(-50%, -50%) scale(2.2); }
    }
    /* Quiet fizzle — bonus landed here but no win. A soft ring that
       ripples out and fades, with a gentle dim pulse. No harsh text. */
    @keyframes rf-bonus-fizzle-ring {
      0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0.85; border-color: rgba(210,210,210,0.6); }
      100% { transform: translate(-50%, -50%) scale(1.7); opacity: 0;    border-color: rgba(140,140,140,0.1); }
    }
    @keyframes rf-bonus-land-lose {
      0%   { box-shadow: 0 0 18px 6px  rgba(140,140,140,0.35), inset 0 0 24px rgba(140,140,140,0.12); transform: scale(1.04); }
      100% { box-shadow: 0 0 22px 6px  rgba(90,90,90,0.2),    inset 0 0 30px rgba(60,60,60,0.08);  transform: scale(1.0); }
    }

    /* Landing shockwave — ring 1 (fast) */
    @keyframes rf-bonus-shockwave-1 {
      0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 1; border-width: 4px; }
      100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; border-width: 1px; }
    }
    /* Landing shockwave — ring 2 (delayed, slower) */
    @keyframes rf-bonus-shockwave-2 {
      0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0.8; border-width: 3px; }
      100% { transform: translate(-50%, -50%) scale(4.5); opacity: 0; border-width: 1px; }
    }
    /* Landing particle burst — 8 dots flying outward */
    @keyframes rf-bonus-particle {
      0%   { transform: translate(0, 0) scale(1); opacity: 1; }
      100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
    }
    /* Sustained golden glow on the landed box */
    @keyframes rf-bonus-sustained-glow {
      0%, 100% { box-shadow: 0 0 16px 5px rgba(232,184,75,0.5), inset 0 0 20px rgba(232,184,75,0.15); }
      50%      { box-shadow: 0 0 28px 10px rgba(232,184,75,0.7), inset 0 0 34px rgba(232,184,75,0.22); }
    }
    /* Persistent marker — pulsing gold star tag that stays on the bonus-
       selected position until the player clicks to reveal the result. */
  
    @keyframes rf-badge-appear {
      0%   { opacity: 0; transform: translateX(-50%) scale(0.8); }
      100% { opacity: 1; transform: translateX(-50%) scale(1); }
    }
  @keyframes rf-bonus-marker-pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(232,184,75,0.3), inset 0 0 12px rgba(232,184,75,0.06); transform: scale(1); }
      50%      { opacity: 1; box-shadow: 0 0 16px rgba(232,184,75,0.6), inset 0 0 24px rgba(232,184,75,0.12); transform: scale(1); }
    }
  `;
}

export default function CardBoard({ odds, bets, caps, phase, onPlace, onRemove, compact = false,
  handEvals = {}, leadingHandIds = [], winnerHandIds = [], bonusPulse = null, rtpChecks = null }) {

  useEffect(() => {injectStyles();}, []);

  const locked = (id) => {
    if (!odds) return true;
    const o = odds.cardOdds.find((x) => x.handId === id);
    return !o || o.locked;
  };
  const lockReason = (id) => {
    if (!odds) return null;
    const o = odds.cardOdds.find((x) => x.handId === id);
    return o ? o.reason : null;
  };
  const payout = (id) => {
    if (!odds) return null;
    const o = odds.cardOdds.find((x) => x.handId === id);
    return o ? o.payout : null;
  };

  const isAntePhase = phase === 'ante';
  const isResolved = phase === 'resolved';

  return (
    <div
      className="rounded-lg flex flex-col"
      style={{
        background: 'var(--theme-bg, #051532)',
        border: '3px solid #e8b84b',
        boxShadow: '0 0 0 1px #000 inset, 0 0 8px rgba(232,184,75,0.3), 0 2px 8px rgba(0,0,0,0.6)',
        flex: '1 1 0',
        minHeight: 0,
        height: '100%',
        padding: compact ? '4px' : '12px'
      }}>
      
      {compact ? null : <SectionTitle capValue={caps ? caps.card : undefined}>CARD BOARD — HAND POSITIONS</SectionTitle>}

      <div
        className="grid grid-cols-5 grid-rows-2"
        style={{ gap: compact ? 3 : 6, flex: 1, minHeight: 0 }}>
        
        {FIXED_HANDS.map((hand, handArrayIdx) => {
          const isLocked = locked(hand.id);
          const p = payout(hand.id);
          const bet = bets.card[hand.id] || 0;
          const rankLabel = handEvals[hand.id] || null;
          const isLeading = leadingHandIds.includes(hand.id);
          const isWinner = winnerHandIds.includes(hand.id);

          return (
            <BettingSlot
              key={hand.id}
              oddsLabel={formatPayout(p)}
              locked={isLocked}
              lockReason={lockReason(hand.id)}
              bet={bet}
              rankLabel={rankLabel}
              isLeading={isLeading}
              isWinner={isWinner}
              isResolved={isResolved}
              isAntePhase={isAntePhase}
              bonusPulse={bonusPulse}
              bonusIndex={handArrayIdx}
              rtpCheck={rtpChecks ? rtpChecks.card[hand.id] : null}
              onPlace={() => onPlace('card', hand.id)}
              onRemove={() => onRemove('card', hand.id)}>
              
              <div style={{ display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'center' }}>
                {hand.cards.map((c, i) =>
                <PlayingCard key={i} card={c} size="sm" />
                )}
              </div>
            </BettingSlot>);

        })}
      </div>
    </div>);

}

const capBadgeStyle = {
  background: 'rgba(0,0,0,0.85)',
  border: '1px solid rgba(234,179,8,0.5)',
  color: '#fbbf24',
  fontSize: 10,
  fontWeight: 900,
  borderRadius: 99,
  padding: '1px 7px',
  whiteSpace: 'nowrap'
};

export function SectionTitle({ children, capValue }) {
  const formatMoney = (v) => v !== undefined ? '$' + v.toFixed(2) : '';
  return (
    <div
      className="flex items-center justify-between flex-shrink-0 mb-2"
      style={{ padding: '0 2px' }}>
      
      <span style={{ flex: 1 }} />
      <span style={{ color: '#E5B64E', fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textAlign: 'center', flex: 'auto' }}>
        {children}
      </span>
      <span style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        {capValue !== undefined &&
        <span style={capBadgeStyle}>Match Ante: {formatMoney(capValue)}</span>
        }
      </span>
    </div>);

}

export function BettingSlot({
  oddsLabel, locked, lockReason = null, bet, onPlace, onRemove, children,
  rankLabel = null, isLeading = false, isWinner = false, isResolved = false,
  bonusPulse = null, bonusIndex = null, isAntePhase = false, rtpCheck = null
}) {
  // ── Vault tint locked treatment (Option A) ──────────────────────────────────
  // When locked: dulled gold border, grayscale cards, dark scrim with padlock
  // watermark, actual odds shown (not "LOCKED"), rank label at bottom, and a
  // small reason text telling the player WHY it's locked.

  // ── Border colour ──────────────────────────────────────────────────────────
  let borderColor = '#C5A059';
  let borderWidth = '3px';
  if (isWinner) {borderColor = '#FFD700';borderWidth = '4px';} else
  if (isLeading && !isResolved) {borderColor = '#e5c158';borderWidth = '3.5px';} else
  if (locked) {borderColor = '#6b6146';borderWidth = '3px';}

  // ── Animation ──────────────────────────────────────────────────────────────
  let animation = 'none';
  let background = 'var(--theme-bg, #04122b)';
  // Any gold-highlighted state (confirmed winner OR currently-leading pre-resolution)
  // needs black text for contrast against the gold background.
  const goldHighlighted = isWinner || isLeading && !isResolved;

  // Bonus marker state — image-based gold placemat overlay
  const isBonusActive = bonusPulse?.card === bonusIndex;
  const isBonusPulsing = isBonusActive && !bonusPulse?.landed;
  const isBonusLanded = isBonusActive && bonusPulse?.landed;
  const markerFading = isBonusLanded && bonusPulse?.markerFading;

  if (isBonusLanded && !markerFading) {
    background = '#2a2000';
    borderColor = '#FFD700';
    borderWidth = '3px';
  } else if (isBonusPulsing) {
    background = '#2a2000';
    borderColor = '#C5A059';
    borderWidth = '3px';
  } else if (isWinner) {
    animation = 'rf-winner-settle 0.6s ease-out forwards';
    background = 'linear-gradient(135deg, #b8860b 0%, #d4a017 30%, #c9900e 60%, #8B6914 100%)';
  } else if (isLeading && !isResolved) {
    animation = 'rf-leader-pulse 2.0s ease-in-out infinite';
    background = 'linear-gradient(135deg, #b8860b 0%, #d4a017 30%, #c9900e 60%, #8B6914 100%)';
  }

  // ── Rank label colour — matches the odds label's palette exactly (bold gold
  // when active, dimmed gold-brown when locked, black when gold-highlighted). ──
  const rankColor = goldHighlighted ? '#000' :
  locked ? '#9a8f6e' :
  '#FFD700';

  // Bottom label: blank during ante (nothing dealt yet), rank if available,
  // "Dead Hand" only after the flop has actually been dealt and the hand
  // is genuinely locked out with no playable rank.
  const bottomLabel = isAntePhase ? null :
  locked ?
  rankLabel || 'Dead Hand' :
  rankLabel;

  return (
    <div
      className="relative rounded-md"
      style={{
        background,
        border: `${borderWidth} solid ${borderColor}`,
        animation,
        opacity: locked ? 0.90 : 1,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: locked ? 'not-allowed' : 'pointer',
        transition: 'border-color 0.2s, border-width 0.2s',
        overflow: 'hidden',
        userSelect: 'none'
      }}
      onClick={() => {if (!locked) onPlace();}}
      onContextMenu={(e) => {e.preventDefault();if (!locked && bet > 0) onRemove();}}>
      
      {/* BONUS MARKER — Rapid Fire style: black overlay, gold border, clean text */}
      {isBonusActive &&
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          background: 'linear-gradient(180deg, rgba(5,15,35,0.95) 0%, rgba(10,25,50,0.95) 100%)',
          borderRadius: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 30,
          opacity: markerFading ? 0 : 1,
          transition: 'opacity 0.8s ease-out',
          animation: isBonusPulsing ? 'rf-bonus-marker-pulse 1.5s ease-in-out infinite' : 'none',
          border: '2px solid #e8b84b',
          boxShadow: isBonusPulsing ? '0 0 12px rgba(232,184,75,0.4), inset 0 0 20px rgba(232,184,75,0.08)' : 'none',
        }}
      >
        <span style={{
          color: '#e8b84b',
          fontWeight: 700,
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          textAlign: 'center',
          fontFamily: "'Cinzel', serif",
          textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          whiteSpace: 'nowrap',
        }}>
          Bonus Round
        </span>
      </div>

      }

      {/* BONUS BADGE — appears after marker fades */}
      {isBonusLanded && bonusPulse?.markerFading &&
      <div style={{
        position: 'absolute',
        bottom: -8,
        left: '50%',
        transform: 'translateX(-50%)',
        background: bonusPulse.cardWon ?
        'linear-gradient(135deg, #e8b84b 0%, #c9971e 100%)' :
        'linear-gradient(135deg, #4a4a4a 0%, #2a2a2a 100%)',
        color: bonusPulse.cardWon ? '#000' : '#ccc',
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 10px',
        borderRadius: 3,
        zIndex: 41,
        letterSpacing: '1px',
        fontFamily: "'Cinzel', serif",
        boxShadow: '0 2px 6px rgba(0,0,0,0.8)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        border: '1px solid ' + (bonusPulse.cardWon ? '#e8b84b' : '#555'),
        opacity: 0,
        animation: 'rf-badge-appear 0.4s ease-out 0.3s forwards'
      }}>
          {bonusPulse.cardWon ? `×${bonusPulse.cardMult} BONUS` : 'BONUS PICK'}
        </div>
      }

      {/* WIN badge — shows on winning positions at resolution */}
      {isWinner && isResolved &&
      <div style={{
        position: 'absolute',
        top: 2,
        right: 4,
        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
        color: '#000',
        fontSize: 9,
        fontWeight: 900,
        padding: '1px 5px',
        borderRadius: 3,
        zIndex: 20,
        letterSpacing: '0.5px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.8)',
        pointerEvents: 'none'
      }}>
          WIN
        </div>
      }

      {/* RTP verification badge — top-left, operator tool only */}
      {!locked && <RtpBadge check={rtpCheck} />}

      {/* Odds label — top (shows actual odds even when locked) */}
      <div style={{
        color: goldHighlighted ? '#000' : locked ? '#9a8f6e' : '#FFD700',
        fontSize: 27,
        fontWeight: 700,
        fontFamily: "'Playfair Display', serif",
        padding: '4px 4px 1px',
        flexShrink: 0,
        lineHeight: 1,
        textAlign: 'center',
        width: '100%'
      }}>
        {oddsLabel}
      </div>

      {/* Cards — flex-1, centred (grayscale filter when locked) */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        padding: '0 4px',
        position: 'relative',
        filter: locked ? 'grayscale(1) brightness(0.6)' : 'none'
      }}>
        {children}
      </div>

      {/* Vault tint scrim + real gold padlock image (only when locked) */}
      {locked &&
      <div style={{
        position: 'absolute',
        inset: '28px 0 48px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
        pointerEvents: 'none'
      }}>
          <img
          src="https://base44.app/api/apps/69fcabf54838c8e18515a406/files/mp/public/69fcabf54838c8e18515a406/06edfeada_gold_lock_cropped.png"
          alt="Locked"
          style={{
            width: 34,
            height: 'auto',
            opacity: 0.95,
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))'
          }} />
        
        </div>
      }

      {/* Bottom label zone — ALWAYS rendered (even with no text) so the box's
          geometry never changes based on ante vs. dealt state. This div's
          minHeight: 48 is load-bearing: the cards zone above is flex: 1 and
          centers within whatever space is left, so if this div disappeared
          entirely (as it did briefly), the cards zone would expand into the
          freed 48px and its centered content would visibly drop — which is
          exactly what happened. Keeping the div (blank text, same height)
          keeps the lock icon centered on the cards at all times. */}
      <div style={{
        fontSize: 21,
        fontWeight: 700,
        fontFamily: "'Cinzel', serif",
        letterSpacing: '1px',
        textAlign: 'center',
        padding: '2px 4px 3px',
        width: '100%',
        flexShrink: 0,
        lineHeight: 1,
        minHeight: 48,
        color: rankColor,
        textTransform: 'uppercase'
      }}>
          {bottomLabel}
        </div>

      {/* Chip — centered on top of the cards */}
      {bet > 0 && !locked &&
      <span
        onClick={(e) => {e.stopPropagation();onRemove();}}
        title="Click to remove bet"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 20,
          cursor: 'pointer',
          filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.95))',
          pointerEvents: 'auto'
        }}>
        
          <Chip amount={bet} scale={0.65} />
        </span>
      }
    </div>);

}