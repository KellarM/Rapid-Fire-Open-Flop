// RTP verification math for the operator's RTP tool.
//
// Scope: the Card and Rank boards only (per spec). The Color and River boards
// are deliberately left out.
//
// Two layers:
//   1. A per-position check — the return implied by the odds actually being
//      offered, compared against the operator's target. Drives the green /
//      red badge on each Betting Position.
//   2. A full audit — every one of the 406 turn/river completions for the flop
//      is enumerated, so the true expected return accounts for tied-hand
//      payout adjustments and for rounds where the board beats all ten hands.
//      This is the only layer that can surface a real deviation, because the
//      engine derives payouts from probability (so a plain per-position check
//      is 1 - house edge by construction).
//
// Nothing here mutates payouts, settlement or the house edge.

import { FIXED_HANDS, cardKey } from './cards';
import { bestHand, evaluate5, compare5, combinations } from './pokerEvaluator';

// "Matches the target" tolerance — 0.1 percentage point (as a fraction).
export const RTP_TOLERANCE = 0.001;

// Return implied by a position's odds: stake 1 returns payout + 1 on a win.
export function positionRtp(probability, payout) {
  if (!(probability > 0) || payout == null) return null;
  return probability * (payout + 1);
}

// The odds that would return `targetPct` on a position with this probability.
// Mirrors the engine's payout formula: payout = (1 - HE) / p - 1.
export function previewPayout(probability, targetPct) {
  if (!(probability > 0)) return null;
  return (targetPct / 100) / probability - 1;
}

// Pass / fail for one position against a target percentage.
export function checkPosition(probability, payout, targetPct) {
  const rtp = positionRtp(probability, payout);
  if (rtp == null) return null;
  return { rtp, ok: Math.abs(rtp - targetPct / 100) <= RTP_TOLERANCE };
}

// ── Full audit ───────────────────────────────────────────────────────────────
// Enumerates all 406 turn/river completions for the flop and returns, for every
// Card and Rank position, the position's win counts and its TRUE expected
// return under the payouts currently on offer.
export function computeRtpAudit(flop, stock, cardOdds, rankOdds) {
  if (!flop || flop.length < 3) return null;

  const flopKeys = new Set(flop.map(cardKey));
  const remaining = stock.filter(c => !flopKeys.has(cardKey(c)));
  const combos = combinations(remaining, 2);

  const soleWins  = new Array(FIXED_HANDS.length).fill(0);
  const splitWins = new Array(FIXED_HANDS.length).fill(0);
  let boardWins = 0;

  for (const combo of combos) {
    const board = [flop[0], flop[1], flop[2], combo[0], combo[1]];
    const handResults = FIXED_HANDS.map(h => bestHand(h.cards, board));
    const boardResult = evaluate5(board);
    const boardBeatsAll = handResults.every(hr => compare5(boardResult, hr) > 0);
    if (boardBeatsAll) { boardWins++; continue; }

    let best = handResults[0];
    for (let i = 1; i < handResults.length; i++) {
      if (compare5(handResults[i], best) > 0) best = handResults[i];
    }
    const winnerIdxs = [];
    for (let i = 0; i < handResults.length; i++) {
      if (compare5(handResults[i], best) === 0) winnerIdxs.push(i);
    }
    if (winnerIdxs.length === 1) soleWins[winnerIdxs[0]]++;
    else winnerIdxs.forEach(i => splitWins[i]++);
  }

  const total = combos.length;
  if (!total) return null;

  // Card positions — the tie split from settleRound reduces the payout when
  // two or more hands tie, which is a genuine deviation from 1 - house edge.
  const card = cardOdds.map((o, i) => {
    let trueRtp = null;
    if (o.payout != null) {
      const full = o.payout + 1;
      const splitReturn = ((o.payout + 1) / 2) * 1.05;
      trueRtp = (soleWins[i] * full + splitWins[i] * splitReturn) / total;
    }
    return {
      handId: o.handId,
      label: FIXED_HANDS[i] ? FIXED_HANDS[i].label : `Hand ${o.handId}`,
      probability: o.probability,
      payout: o.payout,
      locked: o.locked === true,
      wins: o.wins,
      soleWins: soleWins[i],
      splitWins: splitWins[i],
      trueRtp,
    };
  });

  // Rank positions — the winning category is unique per runout (no tie split),
  // but board-win rounds pay nothing, which the engine already excludes.
  const rank = Object.keys(rankOdds).map(label => {
    const o = rankOdds[label];
    const trueRtp = o.payout != null ? (o.wins * (o.payout + 1)) / total : null;
    return {
      label,
      probability: o.probability,
      payout: o.payout,
      locked: o.locked === true,
      wins: o.wins,
      trueRtp,
    };
  });

  return { total, boardWinProb: boardWins / total, card, rank };
}

// Mean true return across the positions that are actually bettable.
export function meanTrueReturn(rows) {
  const live = rows.filter(r => !r.locked && r.trueRtp != null);
  if (live.length === 0) return null;
  return live.reduce((sum, r) => sum + r.trueRtp, 0) / live.length;
}

// ── Live snapshot ────────────────────────────────────────────────────────────
// useGame publishes the current flop's odds here; the operator panel subscribes
// so it can render the justification for the hand in play.
let _snapshot = null;
const _subscribers = new Set();

export function publishRtpSnapshot(snapshot) {
  _snapshot = snapshot;
  _subscribers.forEach(fn => { try { fn(snapshot); } catch {} });
}

export function getRtpSnapshot() {
  return _snapshot;
}

export function subscribeRtpSnapshot(fn) {
  _subscribers.add(fn);
  return () => { _subscribers.delete(fn); };
}