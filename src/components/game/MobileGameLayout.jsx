import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import CardBoard from './CardBoard';
import RightSidebar from './RightSidebar';
import Chip from './Chip';
import ResultOverlay from './ResultOverlay';
import BonusSequence from './BonusSequence';
import RevealPrompt from './RevealPrompt';
import SettingsModal from './SettingsModal';
import HowToPlayModal from './HowToPlayModal';
import GameRulesModal from './GameRulesModal';
import OnboardingIndicator from './OnboardingIndicator';
import MobileLayoutModal from './MobileLayoutModal';
import PlayingCard from './PlayingCard';
import { MOBILE_CHIPS } from '@/lib/game/useGame';
import { formatMoney } from '@/lib/game/cards';
import { Settings, Info } from 'lucide-react';
import { getStructureById, getSavedStructureId, getAnteTierDescriptions, ANTE_STRUCTURE_EVENT } from '@/lib/game/anteStructures';


// ── Scale-to-fit wrapper ─────────────────────────────────────────────────────
// Renders `children` at their NATURAL (desktop-tested) pixel size inside an
// off-screen-sized box, then uniformly shrinks the whole box with a CSS
// transform so it always fits the actual space available — width AND height —
// without ever needing to touch the internals of the wrapped component.
function ScaleToFit({ naturalWidth, naturalHeight, children }) {
  const outerRef = useRef(null);
  const [scale, setScale] = useState(0.3);

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      const s = Math.min(w / naturalWidth, h / naturalHeight, 1);
      if (s > 0 && isFinite(s)) setScale(s);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [naturalWidth, naturalHeight]);

  return (
    <div
      ref={outerRef}
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div style={{
        width: naturalWidth, height: naturalHeight,
        transform: `scale(${scale})`, transformOrigin: 'center center',
        flexShrink: 0,
      }}>
        {children}
      </div>
    </div>
  );
}

// ── Self-sizing scale wrapper (width-driven) ────────────────────────────────
// Unlike ScaleToFit above (which centers content inside an INDEPENDENTLY
// sized box — used where we WANT padding, e.g. the community card row),
// this variant measures only the available WIDTH, computes the scale, and
// sets its OWN height to exactly naturalHeight*scale. There is no separate
// guessed box size to mismatch against, so it is IMPOSSIBLE for this to
// leave extra empty space — the box is always exactly as tall as its
// scaled content, nothing more.
function ScaleToFitWidth({ naturalWidth, naturalHeight, children, onScale }) {
  const outerRef = useRef(null);
  const [scale, setScale] = useState(0.3);

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      if (w === 0) return;
      const s = Math.min(w / naturalWidth, 1);
      if (s > 0 && isFinite(s)) {
        setScale(s);
        // Report the REAL live scale up to the parent — anything inside
        // this box is shrunk by exactly this factor, so any sibling
        // element that wants to visually MATCH a size in here (e.g. the
        // lock icons on the side-bet boards, which live outside this
        // transform and render at true, unscaled pixels) must multiply
        // its natural size by this same number, not just copy the raw
        // style value across.
        onScale?.(s);
      }
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [naturalWidth, onScale]);

  return (
    <div ref={outerRef} style={{ width: '100%', height: naturalHeight * scale, overflow: 'hidden' }}>
      <div style={{
        width: naturalWidth, height: naturalHeight,
        transform: `scale(${scale})`, transformOrigin: 'top left',
      }}>
        {children}
      </div>
    </div>
  );
}

export default function MobileGameLayout({
  game, phase, actions, sounds,
  bonusPulse, setBonusPulse,
  bonusActive, setBonusActive,
  awaitingReveal, setAwaitingReveal,
  showResult, setShowResult,
  playerStats, setPlayerStats,
  boardTheme, setBoardTheme,
  showSettings, setShowSettings,
  showHowToPlay, setShowHowToPlay,
  showGameRules, setShowGameRules,
  dealLabel, subLabel, mobileInstruction, canDeal,
  handlePlaceBet, handleRemoveBet, handleDeal, handleRevealClick,
  handleBonusPulse, handleBonusLand, handleBonusComplete,
  onFold, onClearBets, onNewHand,
  anteStructureId,
  mobileLayout = 'A',
  onOpenMobileLayout = () => {},
}) {
  // Natural size of 5 community cards (70x100 each, fixed) + gaps
  const COMM_NATURAL_W = 70 * 5 + 4 * 4; // 366
  const COMM_NATURAL_H = 100;

  // Natural size of the compact CardBoard: 5 cols x 2 rows of 'sm' cards
  // (62x88 each, 2 per slot) + odds/rank label rows + gaps/padding/border.
  const BOARD_NATURAL_W = 700;
  const BOARD_NATURAL_H = 365;
  // Real live scale factor CardBoard is currently rendered at (see
  // ScaleToFitWidth's onScale). Used to size the sidebar's lock icons so
  // they visually MATCH CardBoard's locks at true rendered pixels, at any
  // device width — not a hardcoded guess for one screen size.
  const [cardScale, setCardScale] = useState(0.3);

  // ── Ante Structure info bubble (ported from desktop BottomFooter) ──
  const [anteStructId, setAnteStructId] = useState(anteStructureId || (() => { try { return getSavedStructureId(); } catch { return 'C'; } }));
  const [showAnteBubble, setShowAnteBubble] = useState(false);
  const [anteBubblePos, setAnteBubblePos] = useState(null);
  const anteInfoRef = useRef(null);
  const footerRef = useRef(null);

  useEffect(() => { setAnteStructId(anteStructureId || anteStructId); }, [anteStructureId]);

  useEffect(() => {
    if (!showAnteBubble || !anteInfoRef.current) return;
    const infoRect = anteInfoRef.current.getBoundingClientRect();
    // Find the footer's top edge (the gold border) to center the bubble
    // between it and the info button.
    const footerEl = footerRef.current;
    let footerTop = infoRect.top - 80; // fallback
    if (footerEl) {
      footerTop = footerEl.getBoundingClientRect().top;
    }
    // Available space between footer top border and info button top edge
    const availableSpace = infoRect.top - footerTop;
    // Center the bubble in that space: position it halfway between
    // the footer border and the info button, measured from the button's top.
    const gap = availableSpace / 2;
    setAnteBubblePos({
      left: infoRect.left + infoRect.width / 2,
      bottom: window.innerHeight - infoRect.top + gap,
    });
  }, [showAnteBubble]);

  useEffect(() => {
    const handler = (e) => {
      setAnteStructId(e.detail || 'C');
      setShowAnteBubble(true);
      setTimeout(() => setShowAnteBubble(false), 4000);
    };
    window.addEventListener(ANTE_STRUCTURE_EVENT, handler);
    return () => window.removeEventListener(ANTE_STRUCTURE_EVENT, handler);
  }, []);

  const activeStruct = getStructureById(anteStructId);
  const anteTiers = activeStruct ? getAnteTierDescriptions(activeStruct) : [];

  // ── Shared content sections — extracted as arrow functions so they can
  //    be rearranged per layout without duplicating code. Each returns the
  //    same JSX the original single-layout version had. ──
  const dealerBar = (
    <div style={{
      flexShrink: 0, height: 22, display: 'flex', alignItems: 'center',
      padding: '0 6px', overflow: 'hidden', whiteSpace: 'nowrap',
      background: 'transparent',
      borderBottom: '1px solid rgba(202,138,4,0.3)',
    }}>
      <span style={{
        fontFamily: 'Oswald, sans-serif', fontSize: '0.75rem', fontWeight: 700,
        fontStyle: 'italic', color: '#f6d860',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {game.statusMessage || ''}
      </span>
    </div>
  );

  const communityCards = (
    <div style={{
      flexShrink: 0, height: 62, display: 'flex', alignItems: 'center',
      gap: 4, padding: '0 4px',
      background: 'transparent',
      borderBottom: '1px solid rgba(202,138,4,0.4)',
    }}>
      <div style={{ flex: 1, height: 52, minWidth: 0 }}>
        <ScaleToFit naturalWidth={COMM_NATURAL_W} naturalHeight={COMM_NATURAL_H}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 1, 2, 3, 4].map(i => (
              <React.Fragment key={i}>
                {game.community[i] ? (
                  <PlayingCard card={game.community[i]} size="community" useImage={false} />
                ) : (
                  <PlayingCard faceDown size="community" />
                )}
              </React.Fragment>
            ))}
          </div>
        </ScaleToFit>
      </div>
    </div>
  );

  const revealPrompt = awaitingReveal && <RevealPrompt onReveal={handleRevealClick} mobileLayout={true} />;

  const cardBoardSection = (
    <div style={{ flexShrink: 0, width: '100%', padding: '0 4px' }}>
      <ScaleToFitWidth naturalWidth={BOARD_NATURAL_W} naturalHeight={BOARD_NATURAL_H} onScale={setCardScale}>
        <CardBoard
          odds={game.flopOdds}
          bets={game.bets}
          caps={game.caps}
          phase={phase}
          onPlace={handlePlaceBet}
          onRemove={handleRemoveBet}
          handEvals={game.handEvals}
          leadingHandIds={game.leadingHandIds}
          winnerHandIds={game.winnerHandIds}
          bonusPulse={bonusPulse}
          compact={true}
        />
      </ScaleToFitWidth>
    </div>
  );

  const rightSidebarSection = (
    <div style={{ flex: '1 1 0', minHeight: 0, padding: '4px 4px 0 4px', overflow: 'hidden' }}>
      <RightSidebar
        phase={phase}
        flopOdds={game.flopOdds}
        riverOdds={game.riverOdds}
        bets={game.bets}
        caps={game.caps}
        boardTotals={game.boardTotals}
        ante={game.ante}
        onPlace={handlePlaceBet}
        onRemove={handleRemoveBet}
        leadingRankLabel={game.leadingRankLabel}
        winnerRankLabel={game.winnerRankLabel}
        leadingColorKeys={game.leadingColorKeys}
        winnerColorKeys={game.winnerColorKeys}
        leadingRiverSide={game.leadingRiverSide}
        winnerRiverSide={game.winnerRiverSide}
        bonusPulse={bonusPulse}
        mobileLayout={true}
        lockSize={34 * cardScale}
      />
    </div>
  );

  // ── Layout content: arranged per layout variant ──
  // A (default): Dealer → Community → CardBoard → RightSidebar → Footer
  // B:           Dealer → RightSidebar → CardBoard → Community → Footer
  // C:           Dealer → CardBoard → Community → Footer → RightSidebar (below)
  // D:           Dealer → Community → RightSidebar (full-width strips) → CardBoard → Footer
  let layoutContent;
  if (mobileLayout === 'B') {
    layoutContent = (
      <>
        {dealerBar}
        {rightSidebarSection}
        {revealPrompt}
        {cardBoardSection}
        {communityCards}
      </>
    );
  } else if (mobileLayout === 'C') {
    layoutContent = (
      <>
        {dealerBar}
        {cardBoardSection}
        {communityCards}
        {revealPrompt}
      </>
    );
  } else if (mobileLayout === 'D') {
    layoutContent = (
      <>
        {dealerBar}
        {communityCards}
        {rightSidebarSection}
        {revealPrompt}
        {cardBoardSection}
      </>
    );
  } else {
    // Layout A (default)
    layoutContent = (
      <>
        {dealerBar}
        {communityCards}
        {revealPrompt}
        {cardBoardSection}
        {rightSidebarSection}
      </>
    );
  }

  return (
    <div
      className={'velvet-board theme-' + boardTheme}
      style={{
        color: '#FFFFFF',
        width: '100dvw',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {layoutContent}

      {/* ── Footer (Player Area) — 2 rows of 3 chips + ante ── */}
      <div ref={footerRef} style={{
        position: 'relative',
        flexShrink: 0, display: 'flex', alignItems: 'center',
        gap: 3, padding: '3px 5px', height: 80,
        borderTop: '3px solid #e8b84b',
        background: 'rgba(0,0,0,0.65)',
      }}>
        {/* Chips — 2 rows of 3: top = .50/.25/.10, bottom = .05/.02/.01 (penny right) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', flexShrink: 0 }}>
          {/* Top row: .50, .25, .10 */}
          <div style={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {MOBILE_CHIPS.slice(3).map(chip => {
              const active = game.selectedChip === chip.value;
              return (
                <button
                  key={chip.value}
                  onClick={() => {
                    if (phase === 'ante') { sounds.playChipPlace(); actions.addToAnte(chip.value); }
                    else { actions.setSelectedChip(chip.value); }
                  }}
                  style={{
                    lineHeight: 0, border: 'none', background: 'transparent', padding: 0,
                    cursor: 'pointer', flexShrink: 0,
                    transform: active ? 'scale(1.15) translateY(-1px)' : 'scale(1)',
                    filter: active ? 'drop-shadow(0 0 3px rgba(251,191,36,0.9))' : 'none',
                    opacity: 1, transition: 'all 0.15s',
                  }}
                >
                  <Chip amount={chip.value} scale={0.52} />
                </button>
              );
            })}
          </div>
          {/* Bottom row: .05, .02, .01 */}
          <div style={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {MOBILE_CHIPS.slice(0, 3).map(chip => {
              const active = game.selectedChip === chip.value;
              return (
                <button
                  key={chip.value}
                  onClick={() => {
                    if (phase === 'ante') { sounds.playChipPlace(); actions.addToAnte(chip.value); }
                    else { actions.setSelectedChip(chip.value); }
                  }}
                  style={{
                    lineHeight: 0, border: 'none', background: 'transparent', padding: 0,
                    cursor: 'pointer', flexShrink: 0,
                    transform: active ? 'scale(1.15) translateY(-1px)' : 'scale(1)',
                    filter: active ? 'drop-shadow(0 0 3px rgba(251,191,36,0.9))' : 'none',
                    opacity: 1, transition: 'all 0.15s',
                  }}
                >
                  <Chip amount={chip.value} scale={0.52} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Ante column — info circle at top, Ante circle at bottom,
            separated by justifyContent: space-between. */}
        <div style={{
          flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '100%',
          paddingTop: 4,
          paddingBottom: 3,
        }}>
          {/* Info button — same as desktop BottomFooter.
              marginTop gives clear, even spacing between the footer's top
              border and the Ante circle below. */}
          <button
            ref={anteInfoRef}
            onClick={() => setShowAnteBubble(s => !s)}
            title="Ante Bonus Structure"
            style={{
              background: showAnteBubble
                ? 'linear-gradient(135deg, #e5c158 0%, #d4af37 100%)'
                : 'rgba(197,160,89,0.15)',
              border: showAnteBubble ? '1px solid #FFD700' : '1px solid rgba(197,160,89,0.4)',
              borderRadius: '50%',
              width: 18, height: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
              transition: 'all 0.15s',
              flexShrink: 0,
              marginTop: 8,
            }}
          >
            <Info size={10} color={showAnteBubble ? '#1a0f00' : '#C5A059'} />
          </button>

          {/* Ante circle — pushed to bottom of footer */}
          {(() => {
            const ANTE_CIRCLE_D = 38.5;
            const anteChipScale = ANTE_CIRCLE_D / 54;
            return (
              <div
                onClick={phase === 'ante' && game.ante > 0 ? actions.clearAnte : undefined}
                style={{
                  cursor: phase === 'ante' && game.ante > 0 ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, width: ANTE_CIRCLE_D, height: ANTE_CIRCLE_D, borderRadius: '50%',
                  border: game.ante > 0 ? '2.75px solid #FFD700' : '2.75px solid #C5A059',
                  background: game.ante > 0
                    ? 'radial-gradient(circle, rgba(255,215,0,0.08) 60%, rgba(0,0,0,0.5) 100%)'
                    : 'linear-gradient(135deg, #f6d860 0%, #e8c22a 30%, #fef08a 55%, #c9960a 80%)',
                  boxShadow: game.ante > 0 ? '0 0 6px 2px rgba(255,215,0,0.7)' : 'none',
                  animation: game.ante > 0 ? 'rf-ante-glow 1.6s ease-in-out infinite' : 'none',
                }}
              >
                {game.ante > 0 ? (
                  <Chip
                    amount={game.ante}
                    scale={anteChipScale}
                    style={{ filter: 'drop-shadow(0 0 5px rgba(255,215,0,0.85)) drop-shadow(0 0 2px rgba(255,215,0,0.9))' }}
                  />
                ) : (
                  <span style={{ color: '#000', fontSize: 7.5, fontWeight: 900, letterSpacing: '0.3px' }}>ANTE</span>
                )}
              </div>
            );
          })()}
        </div>

        {/* Ante info bubble — portal to document.body, positioned above the info button */}
        {showAnteBubble && activeStruct && anteBubblePos && typeof document !== 'undefined' && createPortal(
          <>
            <div onClick={() => setShowAnteBubble(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
            <div style={{
              position: 'fixed',
              left: anteBubblePos.left,
              bottom: anteBubblePos.bottom,
              transform: 'translateX(-50%)',
              zIndex: 9999,
              background: 'linear-gradient(160deg, #1a0f00 0%, #0a0600 100%)',
              border: '1.5px solid rgba(202,138,4,0.7)',
              borderRadius: 10,
              padding: '12px 12px 8px',
              minWidth: 180,
              maxWidth: 220,
              boxShadow: '0 8px 32px rgba(0,0,0,0.9)',
              pointerEvents: 'auto',
            }}>
              {/* Bubble tail */}
              <div style={{
                position: 'absolute', bottom: -7, left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: 12, height: 12, background: '#0a0600',
                borderRight: '1.5px solid rgba(202,138,4,0.7)',
                borderBottom: '1.5px solid rgba(202,138,4,0.7)',
              }} />
              {/* Structure letter badge */}
              <div style={{
                position: 'absolute', top: -9, right: -9,
                width: 20, height: 20, borderRadius: '50%',
                background: 'linear-gradient(135deg, #f6d860 0%, #e8c22a 30%, #fef08a 55%, #c9960a 80%)',
                border: '1.5px solid #FFD700',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
              }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#1a0f00' }}>{activeStruct.id}</span>
              </div>
              <div style={{
                fontSize: 9, fontWeight: 800, color: '#e5c158',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                marginBottom: 6, textAlign: 'center',
              }}>
                How The Ante Pays
              </div>
              <div style={{
                fontSize: 9, color: '#c4b896', lineHeight: 1.4,
                marginBottom: 6, paddingBottom: 5,
                borderBottom: '1px solid rgba(202,138,4,0.3)',
              }}>
                Bet the <b style={{ color: '#facc15' }}>full Ante</b> on one position per board to qualify that board. All payouts are based on the <b style={{ color: '#facc15' }}>Ante amount</b>.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {anteTiers.map((tier, i) => {
                  const color = tier.kind === 'loss' ? '#f87171' : tier.kind === 'bonus' ? '#4ade80' : '#facc15';
                  return (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      gap: 8, fontSize: 10, lineHeight: 1.3,
                    }}>
                      <span style={{ color: '#c4b896', whiteSpace: 'nowrap' }}>{tier.range} {tier.boardWord} Win</span>
                      <span style={{ color, fontWeight: 700, textAlign: 'right' }}>{tier.outcome}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>,
          document.body
        )}

        {/* Bet column — Clear button on top (when active), Bet display below */}
        <div style={{
          flexShrink: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 2, minWidth: 52.25,
          alignSelf: 'flex-start',
          marginTop: 2,
        }}>
          {/* Top slot: Clear button — fixed height reserved even when empty */}
          <div style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(phase === 'openflop' || phase === 'postturn') && game.totalWagered > 0 && (
              <button onClick={onClearBets}
                style={{ padding: '2px 6px', borderRadius: 3,
                  border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(127,29,29,0.4)',
                  color: '#fca5a5', fontSize: 7, fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap' }}>CLR</button>
            )}
          </div>
          {/* Bottom: Bet display — always visible */}
          <div style={{
            padding: '1.25px 5px', borderRadius: 5,
            border: '1px solid rgba(234,179,8,0.4)', background: 'rgba(0,0,0,0.6)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <span style={{ fontSize: '0.48rem', color: '#a8956a', fontWeight: 700, letterSpacing: '0.04em' }}>BET</span>
            <span style={{ fontSize: '0.69rem', color: '#FFD700', fontWeight: 900 }}>{formatMoney(game.totalWagered)}</span>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Deal button */}
        <button
          onClick={handleDeal}
          disabled={!canDeal}
          style={{
            flexShrink: 0,
            width: 70, height: 46,
            padding: 0,
            borderRadius: 6,
            border: '2.0625px solid #4ade80',
            background: canDeal ? '#15803d' : '#0a3a1a',
            color: '#fff', fontWeight: 900, fontSize: '0.72rem',
            cursor: canDeal ? 'pointer' : 'default',
            letterSpacing: '0.04em', opacity: canDeal ? 1 : 0.4,
            whiteSpace: 'normal',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1.1,
            textAlign: 'center',
            alignSelf: 'flex-start',
            marginTop: 2,
          }}
        >
          <span style={{ width: '100%', whiteSpace: 'normal', textAlign: 'center' }}>{dealLabel}</span>
        </button>

        <div style={{ flex: 1 }} />

        {/* Bank column — Fold button on top (when active), Bank display below */}
        <div style={{
          flexShrink: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 2,
          alignSelf: 'flex-start',
          marginTop: 2,
        }}>
          {/* Top slot: Fold button — fixed height reserved even when empty */}
          <div style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(phase === 'openflop' || phase === 'postturn') && (
              <button onClick={onFold}
                style={{ padding: '2px 6px', borderRadius: 3,
                  border: '1px solid #C5A059', background: 'rgba(127,29,29,0.4)',
                  color: '#FF6B6B', fontSize: 7, fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap' }}>FOLD</button>
            )}
          </div>
          {/* Bottom: Bank display — always visible */}
          <div style={{
            padding: '1.375px 5.5px', borderRadius: 5,
            border: '2.0625px solid #eab308', background: '#000',
          }}>
            <span style={{ fontSize: '0.69rem', fontWeight: 900, color: '#FFD700', textShadow: '0 0 4px rgba(251,191,36,0.7)' }}>
              {formatMoney(game.bank)}
            </span>
          </div>
        </div>

        {/* Mobile round instruction — occupies only the empty bottom strip.
            Absolute positioning keeps every existing footer object at its
            current size and position. The horizontal clamp corresponds to
            the red-boxed area: it starts beneath the Bet/Deal region and
            ends before the right edge, never crossing the footer bounds. */}
        <div
          aria-live="polite"
          style={{
            position: 'absolute',
            left: '36%', right: 5, bottom: 3,
            height: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            padding: '0 2px',
            color: '#FFD700',
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(0.52rem, 2.20vw, 0.82rem)',
            fontWeight: 900,
            letterSpacing: '0.015em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            textAlign: 'center',
            textOverflow: 'clip',
            pointerEvents: 'none',
            textShadow: '0 0 3px rgba(251,191,36,0.7)',
            transform: 'scaleY(1.15)',
          }}
        >
          {mobileInstruction}
        </div>

        {/* Gear */}
        <button onClick={() => setShowSettings(true)}
          className="rf-onboard-gear"
          style={{
            flexShrink: 0, width: 30.25, height: 30.25, borderRadius: 6,
            border: '1px solid rgba(234,179,8,0.5)', background: 'rgba(0,0,0,0.5)',
            color: '#fde047', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Settings size={16.5} />
        </button>
      </div>

      {/* ── Overlays & Modals ── */}
      {bonusActive && game.bonus && (
        <BonusSequence
          cardIdx={game.bonus.cardIdx}
          rankIdx={game.bonus.rankIdx}
          colorRiverIdx={game.bonus.colorRiverIdx}
          onPulse={handleBonusPulse}
          onLand={handleBonusLand}
          onComplete={handleBonusComplete}
          soundEnabled={sounds.isSoundEnabled()}
        />
      )}

      {showResult && game.result && (
        <ResultOverlay result={game.result} ante={game.ante} bonus={game.bonus} onClose={actions.newHand} />
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        playerStats={playerStats}
        boardTheme={boardTheme}
        setBoardTheme={setBoardTheme}
        onHowToPlay={() => { setShowSettings(false); setShowHowToPlay(true); }}
        onGameRules={() => { setShowSettings(false); setShowGameRules(true); }}
        onResetBank={(amount) => { actions.resetBank(amount); setPlayerStats({ totalBets: 0, totalWins: 0, roundsPlayed: 0, roundsWon: 0, highestMultiplier: 0, highestBalance: null, lowestBalance: null }); }}
        onMobileLayout={onOpenMobileLayout}
      />
      <HowToPlayModal isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
      <GameRulesModal isOpen={showGameRules} onClose={() => setShowGameRules(false)} />
      <OnboardingIndicator />

      {/* Layout C — RightSidebar below footer */}
      {mobileLayout === 'C' && (
        <div style={{ flexShrink: 0, padding: '4px 4px 2px 4px', borderTop: '2px solid rgba(202,138,4,0.4)', maxHeight: '35dvh', overflow: 'hidden' }}>
          <RightSidebar
            phase={phase}
            flopOdds={game.flopOdds}
            riverOdds={game.riverOdds}
            bets={game.bets}
            caps={game.caps}
            boardTotals={game.boardTotals}
            ante={game.ante}
            onPlace={handlePlaceBet}
            onRemove={handleRemoveBet}
            leadingRankLabel={game.leadingRankLabel}
            winnerRankLabel={game.winnerRankLabel}
            leadingColorKeys={game.leadingColorKeys}
            winnerColorKeys={game.winnerColorKeys}
            leadingRiverSide={game.leadingRiverSide}
            winnerRiverSide={game.winnerRiverSide}
            bonusPulse={bonusPulse}
            mobileLayout={true}
            lockSize={34 * cardScale}
          />
        </div>
      )}
    </div>
  );
}