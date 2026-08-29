import React, { useState, useEffect, useCallback } from 'react';
import { useGame, loadStatsValue, saveStatsValue, clearStatsValue } from '@/lib/game/useGame';
import { formatMoney } from '@/lib/game/cards';
import { useGameSounds } from '@/lib/game/useGameSounds';
import PreviousHands from '@/components/game/PreviousHands';
import DealerArea from '@/components/game/DealerArea';
import CardBoard from '@/components/game/CardBoard';
import RightSidebar from '@/components/game/RightSidebar';
import BottomFooter from '@/components/game/BottomFooter';
import ResultOverlay from '@/components/game/ResultOverlay';
import BonusSequence from '@/components/game/BonusSequence';
import RevealPrompt from '@/components/game/RevealPrompt';
import { playWin, playLose, setBonusSfxEnabled } from '@/lib/game/useBonusAudio';
import SettingsModal from '@/components/game/SettingsModal';
import HowToPlayModal from '@/components/game/HowToPlayModal';
import GameRulesModal from '@/components/game/GameRulesModal';
import OnboardingIndicator from '@/components/game/OnboardingIndicator';
import { useViewportTier } from '@/hooks/useViewportTier';
import MobileGameLayout from '@/components/game/MobileGameLayout';
import MobileLayoutModal from '@/components/game/MobileLayoutModal';

export default function GameTable() {
  const game = useGame();
  const { phase, actions } = game;
  const sounds = useGameSounds();

  const [showSettings, setShowSettings] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showGameRules, setShowGameRules] = useState(false);
  const [boardTheme, setBoardThemeState] = useState(() => {
    try { return localStorage.getItem('rfpf_theme') || (() => {
      const m = document.cookie.match(/(?:^|;\s*)rfpf_theme=([^;]*)/);
      return m ? decodeURIComponent(m[1]) : 'blue';
    })(); } catch { return 'blue'; }
  });

  const setBoardTheme = (t) => {
    setBoardThemeState(t);
    try { localStorage.setItem('rfpf_theme', t); } catch {}
    try {
      const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
      document.cookie = `rfpf_theme=${encodeURIComponent(t)}; expires=${expires}; path=/; SameSite=Lax`;
    } catch {}
  };
  // ── Result overlay — NEVER auto-opens ──────────────────────────────────
  // After resolution: bonus sequence runs (or is skipped in the no-bonus
  // safety fallback) -> awaitingReveal becomes true -> "Click Anywhere /
  // Open Window" prompt shows -> player clicks anywhere -> showResult opens.
  const [mobileLayout, setMobileLayout] = useState(() => {
    try { return localStorage.getItem('rfpf_mobileLayout') || 'A'; } catch { return 'A'; }
  });
  const [showMobileLayout, setShowMobileLayout] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [awaitingReveal, setAwaitingReveal] = useState(false);
  const [bonusPulse, setBonusPulse] = useState({ card: null, rank: null, colorRiver: null, landed: false, cardWon: false, rankWon: false, colorRiverWon: false, cardMult: 5, rankMult: 4, colorRiverMult: 3, markerFading: false });
  const [bonusActive, setBonusActive] = useState(false);
  const [playerStats, setPlayerStats] = useState(() => {
    const saved = loadStatsValue();
    if (saved && typeof saved.roundsPlayed === 'number') {
      return {
        totalBets: saved.totalBets || 0,
        totalWins: saved.totalWins || 0,
        roundsPlayed: saved.roundsPlayed || 0,
        roundsWon: saved.roundsWon || 0,
        highestMultiplier: saved.highestMultiplier || 0,
        highestBalance: saved.highestBalance ?? null,
        lowestBalance: saved.lowestBalance ?? null,
      };
    }
    return {
      totalBets: 0, totalWins: 0,
      roundsPlayed: 0, roundsWon: 0,
      highestMultiplier: 0,
      highestBalance: null, lowestBalance: null,
    };
  });

  // Start ambient on first user interaction
  useEffect(() => {
    const handler = () => sounds.preloadSounds();
    window.addEventListener('pointerdown', handler, { once: true });
    return () => window.removeEventListener('pointerdown', handler);
  }, []);

  // Sync bonus audio SFX gate with the game SFX channel
  useEffect(() => {
    setBonusSfxEnabled(sounds.isSfxEnabled());
  }, [sounds]);

  // ── Bonus sequence + result overlay timing ─────────────────────────────
  // When phase becomes 'resolved':
  // 1. Bonus sequence runs (~10 seconds) — pulse waves on card hands + side bets
  // 2. After bonus completes, show the result overlay (with bonus info)
  // If no bonus data (safety fallback), show overlay after 5 seconds.
  useEffect(() => {
    if (phase === 'resolved' && game.result) {
      setShowResult(false);
      setAwaitingReveal(false);
      setBonusPulse({ card: null, rank: null, colorRiver: null, landed: false, cardWon: false, rankWon: false, colorRiverWon: false, cardMult: 5, rankMult: 4, colorRiverMult: 3, markerFading: false });

      if (game.bonus) {
        // Start bonus sequence — BonusSequence component handles the animation
        setBonusActive(true);
      } else {
        // Safety fallback: no bonus data — skip straight to the click-anywhere
        // prompt. The result overlay NEVER auto-opens under any path.
        setAwaitingReveal(true);
      }
    } else {
      setShowResult(false);
      setBonusActive(false);
      setAwaitingReveal(false);
      setBonusPulse({ card: null, rank: null, colorRiver: null, landed: false, cardWon: false, rankWon: false, colorRiverWon: false, cardMult: 5, rankMult: 4, colorRiverMult: 3, markerFading: false });
    }
  }, [phase, game.result, game.bonus]);

  // Bonus sequence callbacks
  const handleBonusPulse = useCallback((cardPos, rankPos, colorRiverPos) => {
    setBonusPulse(prev => ({
      ...prev,
      card: cardPos !== null ? cardPos : prev.card,
      rank: rankPos !== null ? rankPos : prev.rank,
      colorRiver: colorRiverPos !== null ? colorRiverPos : prev.colorRiver,
      landed: false,
    }));
  }, []);

  const handleBonusLand = useCallback((cardIdx, rankIdx, colorRiverIdx) => {
    if (!game.bonus) return;
    setBonusPulse({
      card: cardIdx,
      rank: rankIdx,
      colorRiver: colorRiverIdx,
      landed: true,
      markerFading: false,
      cardWon: game.bonus.cardWon,
      rankWon: game.bonus.rankWon,
      colorRiverWon: game.bonus.colorRiverWon,
      cardMult: game.bonus.cardMult,
      rankMult: game.bonus.rankMult,
      colorRiverMult: game.bonus.colorRiverMult,
    });
    // After 2 seconds, fade the marker to reveal the bonus badge underneath
    setTimeout(() => {
      setBonusPulse(prev => ({ ...prev, markerFading: true }));
    }, 2000);
    // Play win or lose sound based on whether any bonus paid
    if (game.bonus.cardWon || game.bonus.rankWon || game.bonus.colorRiverWon) {
      playWin();
    } else {
      playLose();
    }
  }, [game.bonus]);

  const handleBonusComplete = useCallback(() => {
    setBonusActive(false);
    setAwaitingReveal(true);
  }, []);

  // Player clicked anywhere on screen while the reveal prompt was showing
  const handleRevealClick = useCallback(() => {
    setAwaitingReveal(false);
    setShowResult(true);
  }, []);

  // Track stats per resolved hand
  useEffect(() => {
    if (phase === 'resolved' && game.result) {
      const r = game.result;
      const betTotal  = r.totalWagered ?? 0;
      const winTotal  = r.totalPayout  ?? 0;
      const multiplier = betTotal > 0 ? winTotal / betTotal : 0;
      setPlayerStats(prev => ({
        totalBets:         prev.totalBets + betTotal,
        totalWins:         prev.totalWins + winTotal,
        roundsPlayed:      prev.roundsPlayed + 1,
        roundsWon:         prev.roundsWon + (winTotal > betTotal ? 1 : 0),
        highestMultiplier: Math.max(prev.highestMultiplier, multiplier),
        highestBalance:    prev.highestBalance == null ? game.bank : Math.max(prev.highestBalance, game.bank),
        lowestBalance:     prev.lowestBalance  == null ? game.bank : Math.min(prev.lowestBalance,  game.bank),
      }));
    }
  }, [phase]);

  // Persist player stats to localStorage + cookie on every change
  useEffect(() => { saveStatsValue(playerStats); }, [playerStats]);

  const handlePlaceBet = useCallback((...args) => {
    actions.placeBet(...args);
  }, [actions]);

  const handleRemoveBet = useCallback((...args) => {
    sounds.playChipRemove();
    actions.removeBet(...args);
  }, [actions]);

  const handleDeal = () => {
    sounds.playCardDeal();
    if (phase === 'ante')      actions.deal();
    else if (phase === 'openflop') actions.dealTurn();
    else if (phase === 'postturn') actions.dealRiver();
  };

  let dealLabel = 'DEAL';
  let subLabel  = 'PLACE AN ANTE TO DEAL';
  let mobileInstruction = 'PLACE AN ANTE TO DEAL';
  let canDeal   = false;
  if (phase === 'ante') {
    subLabel = game.ante > 0
      ? `ANTE ${formatMoney(game.ante)} — PRESS TO DEAL FLOP`
      : 'SELECTING A CHIP PLACES AN ANTE, THEN DEAL';
    mobileInstruction = subLabel;
    canDeal = game.ante > 0 && game.ante <= game.bank;
  } else if (phase === 'openflop') {
    dealLabel = 'DEAL TURN';
    subLabel  = game.selectedChip
      ? 'PLACE BETS ON ANY BOARD — THEN DEAL TURN'
      : 'SELECT A CHIP, THEN PLACE BETS ON ANY BOARD';
    mobileInstruction = 'PLACE BETS ON ANY BOARD — THEN DEAL TURN';
    canDeal   = !game.computing;
  } else if (phase === 'postturn') {
    dealLabel = 'DEAL RIVER';
    subLabel  = 'PLACE RIVER BET OR DEAL NOW';
    mobileInstruction = subLabel;
    canDeal   = true;
  }

  const viewportTier = useViewportTier();

  // ── Mobile portrait layout swap ────────────────────────────────────────
  // Desktop/tablet use the existing layout. Mobile portrait swaps to
  // MobileGameLayout uses a 60/40 left-right split: card board left, side boards right.
  // All game state, effects, and callbacks are computed above; both layouts
  // receive the same data.
  if (viewportTier === 'mobile') {
    return (
      <>
      <MobileGameLayout
        game={game}
        phase={phase}
        actions={actions}
        sounds={sounds}
        bonusPulse={bonusPulse}
        setBonusPulse={setBonusPulse}
        bonusActive={bonusActive}
        setBonusActive={setBonusActive}
        awaitingReveal={awaitingReveal}
        setAwaitingReveal={setAwaitingReveal}
        showResult={showResult}
        setShowResult={setShowResult}
        playerStats={playerStats}
        setPlayerStats={setPlayerStats}
        boardTheme={boardTheme}
        setBoardTheme={setBoardTheme}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        showHowToPlay={showHowToPlay}
        setShowHowToPlay={setShowHowToPlay}
        showGameRules={showGameRules}
        setShowGameRules={setShowGameRules}
        dealLabel={dealLabel}
        subLabel={subLabel}
        mobileInstruction={mobileInstruction}
        canDeal={canDeal}
        handlePlaceBet={handlePlaceBet}
        handleRemoveBet={handleRemoveBet}
        handleDeal={handleDeal}
        handleRevealClick={handleRevealClick}
        handleBonusPulse={handleBonusPulse}
        handleBonusLand={handleBonusLand}
        handleBonusComplete={handleBonusComplete}
        onFold={actions.fold}
        onClearBets={actions.clearBets}
        onNewHand={actions.newHand}
        anteStructureId={game.anteStructure}
        mobileLayout={mobileLayout}
        onOpenMobileLayout={() => setShowMobileLayout(true)}
      />
      {showMobileLayout && (
        <MobileLayoutModal
          current={mobileLayout}
          onSelect={(v) => { setMobileLayout(v); try { localStorage.setItem('rfpf_mobileLayout', v); } catch {} setShowMobileLayout(false); }}
          onClose={() => setShowMobileLayout(false)}
        />
      )}
      </>
    );
  }

  return (
    <div
      className={`velvet-board theme-${boardTheme}`}
      style={{
        color: '#FFFFFF',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ■■ Main content row — zero bottom padding so footer connects flush ■■ */}
      <div
        style={{
          flex: '1 1 0',
          minHeight: 0,
          display: 'flex',
          padding: '6px 6px 0 6px',
          gap: 6,
        }}
      >
        {/* LEFT: Previous Hands */}
        <div style={{ width: 224, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <PreviousHands history={game.history} />
        </div>

        {/* CENTER: Dealer area + Card Board */}
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, height: '100%' }}>
          <DealerArea
            statusMessage={game.statusMessage}
            community={game.community}
            revealed={game.revealed}
            phase={phase}
          />
          {awaitingReveal && <RevealPrompt onReveal={handleRevealClick} />}
          <div style={{ flex: '1 1 0', minHeight: 0 }}>
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
            />
          </div>
        </div>

        {/* RIGHT: Sidebar — full height of content row */}
        <div style={{ width: 285, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
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
          />
        </div>
      </div>

      {/* ■■ Footer — full width, flush against content row ■■ */}
      <div style={{ flexShrink: 0, width: '100%', padding: '0 6px 6px 6px' }}>
        <BottomFooter
          bank={game.bank}
          ante={game.ante}
          totalWagered={game.totalWagered}
          selectedChip={game.selectedChip}
          phase={phase}
          canDeal={canDeal}
          dealLabel={dealLabel}
          subLabel={subLabel}
          anteStructureId={game.anteStructure}
          onChipSelect={(v) => {
            if (phase === 'ante') {
              sounds.playChipPlace();
              actions.addToAnte(v);
            } else {
              actions.setSelectedChip(v);
            }
          }}
          onClearAnte={actions.clearAnte}
          onClearBets={actions.clearBets}
          onFold={actions.fold}
          onDeal={handleDeal}
          onNewHand={actions.newHand}
          onSettings={() => setShowSettings(true)}
        />
      </div>

      {/* ── RNG Bonus sequence — runs during resolution, before result overlay ── */}
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
        onMobileLayout={() => setShowMobileLayout(true)}
      />
      <HowToPlayModal isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
      <GameRulesModal isOpen={showGameRules} onClose={() => setShowGameRules(false)} />
      <OnboardingIndicator />
    </div>
  );
}