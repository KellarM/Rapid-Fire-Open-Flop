import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RefreshCw, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight, Shield, FileDown, Search, BarChart3 } from 'lucide-react';
import { runOpenFlopAudit, resetWorker } from '@/lib/openFlopWorkerBridge';
import { downloadOpenFlopExcel } from '@/lib/game/openFlopExcelExporter';
import { DEALER_STOCK, SUIT_SYMBOL } from '@/lib/game/cards';

import compactMatrix from '@/lib/game/openFlopMatrixCompact.json';

// ── Constants ──────────────────────────────────────────────────
const HAND_LABELS = [
  'Hand 1 — A♦10♥', 'Hand 2 — K♣K♠', 'Hand 3 — Q♣J♠', 'Hand 4 — Q♠10♠',
  'Hand 5 — J♣9♣', 'Hand 6 — 8♦6♦', 'Hand 7 — 7♦7♠', 'Hand 8 — 4♥2♥',
  'Hand 9 — 3♣3♥', 'Hand 10 — A♥5♦',
];
const RANK_NAMES = ['1 Pair', '2 Pair', '3 Of A Kind', 'Straight', 'Flush', 'Full House', '4 Of A Kind'];

// ── Card pool for flop filter dropdowns ──────────────────────
// Build from DEALER_STOCK (32-card community stock) formatted to match
// the compact matrix's string format: "rank" + suit symbol (e.g. "A♠", "10♥")
const CARD_POOL = DEALER_STOCK.map(c => `${c.rank}${SUIT_SYMBOL[c.suit]}`);

// Sort for display: group by suit (♠♥♦♣), then rank descending (A→2)
const RANK_ORDER = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
const SUIT_ORDER = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 };
const SORTED_CARD_POOL = [...CARD_POOL].sort((a, b) => {
  const sA = a.slice(-1), sB = b.slice(-1);
  if (sA !== sB) return SUIT_ORDER[sA] - SUIT_ORDER[sB];
  return RANK_ORDER[a.slice(0, -1)] - RANK_ORDER[b.slice(0, -1)];
});

// Check if a card string is red (hearts or diamonds)
function isRedCard(cardStr) {
  return cardStr.includes('♥') || cardStr.includes('♦');
}

// Find a flop in the compact matrix by 3 cards (unordered match).
// C(32,3) = 4,960 = TOTAL_FLOPS, so every valid combo exists.
function findFlopByCards(c1, c2, c3) {
  if (!c1 || !c2 || !c3) return -1;
  const target = [c1, c2, c3].sort();
  for (let i = 0; i < TOTAL_FLOPS; i++) {
    const f = compactMatrix.flops[i];
    const fc = [f[1], f[2], f[3]].sort();
    if (fc[0] === target[0] && fc[1] === target[1] && fc[2] === target[2]) return i;
  }
  return -1;
}

// Odds thresholds — positions outside this window are DEAD (not bettable)
// Must match the engine config in oddsEngine.js
// Separate per-board so they can be tuned independently
const ODDS_THRESHOLD_CARD_HIGH = 300;
const ODDS_THRESHOLD_CARD_LOW  = 1.1;
const ODDS_THRESHOLD_RANK_HIGH = 300;
const ODDS_THRESHOLD_RANK_LOW  = 1.1;

// Check if true odds fall outside the bettable window for a given board type
function isThresholdDead(trueOdds, high, low) {
  if (trueOdds === null) return true;
  return trueOdds > high || trueOdds < low;
}

// Certification modules (4 round types)
const MODULES = [
  {
    id: 'quick',
    name: 'Quick Check',
    rounds: 100_000,
    standard: 'Internal Pre-Flight',
    description: '100K Monte Carlo rounds — fast sanity check per flop. All 17 positions tracked simultaneously.',
    rtpLow: 93, rtpHigh: 99,
    badge: 'bg-slate-700 text-slate-300',
    accentColor: 'border-slate-500',
  },
  {
    id: 'presubmission',
    name: 'Pre-Submission',
    rounds: 500_000,
    standard: 'House Internal Standard',
    description: '500K rounds — internal compliance gate. All 17 positions tracked simultaneously.',
    rtpLow: 94, rtpHigh: 98.5,
    badge: 'bg-blue-900/40 text-blue-300',
    accentColor: 'border-blue-600',
  },
  {
    id: 'gli',
    name: 'GLI / BMM',
    rounds: 1_000_000,
    standard: 'GLI-11 / BMM Technical',
    description: '1M rounds — GLI-11 / BMM depth. All 17 positions tracked simultaneously.',
    rtpLow: 95, rtpHigh: 98,
    badge: 'bg-amber-900/40 text-amber-300',
    accentColor: 'border-amber-600',
  },
  {
    id: 'full',
    name: 'Full Certification',
    rounds: 2_000_000,
    standard: 'eCOGRA / Full Certification',
    description: '2M rounds — eCOGRA / Full Certification depth. All 17 positions tracked simultaneously.',
    rtpLow: 95, rtpHigh: 98,
    badge: 'bg-green-900/40 text-green-300',
    accentColor: 'border-green-600',
  },
];

// ── Parse compact matrix ──────────────────────────────────────
const TOTAL_FLOPS = compactMatrix.flops.length;

function getFlopData(flopIndex) {
  const f = compactMatrix.flops[flopIndex];
  const to = compactMatrix.trueOdds[flopIndex];
  return {
    flopId: f[0],
    cards: [f[1], f[2], f[3]],
    boardWinProb: f[4],
    cardProbs: f.slice(5, 15),
    rankProbs: f.slice(15, 22),
    cardTrueOdds: to.slice(0, 10),
    rankTrueOdds: to.slice(10, 17),
  };
}

// ── UI Helpers ─────────────────────────────────────────────────
function StatusIcon({ status }) {
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === 'fail') return <XCircle className="w-4 h-4 text-red-400" />;
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  return null;
}

function RTPPill({ rtp, low, high }) {
  const v = parseFloat(rtp);
  if (isNaN(v) || v === 0) return <span className="text-slate-500 font-mono">—</span>;
  const ok = v >= low && v <= high;
  const warn = !ok && v >= low - 2 && v <= high + 2;
  if (ok) return <span className="text-emerald-400 font-bold font-mono">{rtp}%</span>;
  if (warn) return <span className="text-amber-400 font-bold font-mono">{rtp}%</span>;
  return <span className="text-red-400 font-bold font-mono">{rtp}%</span>;
}

function formatPct(p) {
  if (p === 0) return '0.00%';
  if (p < 0.001) return '<0.1%';
  return (p * 100).toFixed(2) + '%';
}

function formatOdds(o) {
  if (o === null) return 'DEAD';
  if (o === 0) return '0.0000:1';
  return o.toFixed(2) + ':1';
}

function formatElapsed(seconds) {
  if (seconds < 60) return seconds + 's';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + 'm ' + s + 's';
}

// ── Result Row Component ──────────────────────────────────────
function ResultRow({ label, wins, observedProb, trueProb, trueOdds, observedRtp, dead, rtpLow, rtpHigh, isLast }) {
  const variance = dead ? null : ((observedProb - trueProb) / trueProb * 100);
  const status = dead ? null
    : Math.abs(variance) < 2 ? 'pass'
    : Math.abs(variance) < 5 ? 'warn'
    : 'fail';
  const count406 = dead ? null : Math.round(trueProb * 406);

  return (
    <tr className={isLast ? '' : 'border-b border-slate-700/50'}>
      <td className="px-2 py-1.5 text-xs text-slate-300 font-medium">{label}</td>
      <td className="px-2 py-1.5 text-xs font-mono text-slate-300 text-right">{dead ? '—' : wins.toLocaleString()}</td>
      <td className="px-2 py-1.5 text-xs font-mono text-slate-400 text-right">{dead ? '—' : count406}</td>
      <td className="px-2 py-1.5 text-xs font-mono text-slate-400 text-right">{dead ? '—' : formatPct(trueProb)}</td>
      <td className="px-2 py-1.5 text-xs font-mono text-slate-300 text-right">{dead ? '—' : formatPct(observedProb)}</td>
      <td className="px-2 py-1.5 text-xs font-mono text-slate-400 text-right">{formatOdds(trueOdds)}</td>
      <td className="px-2 py-1.5 text-xs font-mono text-right">
        {dead ? <span className="text-slate-600">DEAD</span> : <RTPPill rtp={observedRtp.toFixed(2)} low={rtpLow} high={rtpHigh} />}
      </td>
      <td className="px-2 py-1.5 text-xs font-mono text-right">
        {dead ? '—' : (
          <span className={variance > 0 ? 'text-emerald-400' : variance < 0 ? 'text-red-400' : 'text-slate-400'}>
            {variance > 0 ? '+' : ''}{variance.toFixed(2)}%
          </span>
        )}
      </td>
      <td className="px-2 py-1.5 text-center">{dead ? null : <StatusIcon status={status} />}</td>
    </tr>
  );
}

// ── Module Panel ───────────────────────────────────────────────
function ModulePanel({ module, flopData, flopIndex }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [result, setResult] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const abortRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const run = async () => {
    if (!flopData) return;
    setRunning(true);
    abortRef.current = false;
    setResult(null);
    setProgress(0);
    setElapsed(0);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 500);

    try {
      const trueProbabilities = {
        cardProbs: flopData.cardProbs,
        rankProbs: flopData.rankProbs,
        boardWinProb: flopData.boardWinProb,
      };

      const data = await runOpenFlopAudit({
        flopCards: flopData.cards,
        rounds: module.rounds,
        trueProbabilities,
        mode: 'monte-carlo',
        onProgress: (pct, d, t) => {
          setProgress(pct);
          setDone(d);
          setTotal(t);
        },
      });
      setResult(data);
      setExpanded(true);
    } catch (err) {
      console.error('Audit failed:', err);
    } finally {
      setRunning(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  };

  const runEnumeration = async () => {
    if (!flopData) return;
    setRunning(true);
    setResult(null);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 500);

    try {
      const trueProbabilities = {
        cardProbs: flopData.cardProbs,
        rankProbs: flopData.rankProbs,
        boardWinProb: flopData.boardWinProb,
      };

      const data = await runOpenFlopAudit({
        flopCards: flopData.cards,
        rounds: 406,
        trueProbabilities,
        mode: 'enumeration',
        onProgress: () => {},
      });
      setResult(data);
      setExpanded(true);
    } catch (err) {
      console.error('Enumeration failed:', err);
    } finally {
      setRunning(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  };

  return (
    <div className={`rounded-xl border ${module.accentColor} bg-slate-900/60 overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2 py-1 rounded ${module.badge}`}>{module.name}</span>
          <span className="text-xs text-slate-400">{module.standard}</span>
          <span className="text-xs text-slate-500">{module.rounds.toLocaleString()} rounds</span>
        </div>
        <div className="flex items-center gap-2">
          {running && (
            <span className="text-xs text-slate-400 font-mono">
              {done.toLocaleString()}/{total.toLocaleString()} ({(progress * 100).toFixed(0)}%) · {formatElapsed(elapsed)}
            </span>
          )}
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Description */}
      {!expanded && (
        <div className="px-4 pb-2">
          <p className="text-xs text-slate-500">{module.description}</p>
        </div>
      )}

      {/* Controls + Results */}
      {expanded && (
        <div className="px-4 pb-4">
          {/* Run controls */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={run}
              disabled={running || !flopData}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white transition-colors"
            >
              {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {running ? 'Running...' : `Run ${module.rounds.toLocaleString()} Rounds`}
            </button>
            <button
              onClick={runEnumeration}
              disabled={running || !flopData}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-300 transition-colors"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Full Enumeration (406 combos)
            </button>
          </div>

          {/* Progress bar */}
          {running && (
            <div className="mb-4">
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div className="bg-slate-500 h-full transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Total Rounds</p>
                  <p className="text-lg font-bold text-white font-mono">{result.totalRounds.toLocaleString()}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Board Win %</p>
                  <p className="text-lg font-bold text-white font-mono">{(result.boardWinProb * 100).toFixed(2)}%</p>
                  <p className="text-xs text-slate-500">True: {(result.trueBoardWinProb * 100).toFixed(2)}%</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Mode</p>
                  <p className="text-sm font-bold text-white">{result.mode === 'enumeration' ? 'Full Enumeration' : 'Monte Carlo'}</p>
                </div>
              </div>

              {/* Card Hand Results */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Card Hand Results</h4>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-400">Position</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-400">Win Count</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-400">406 / Count</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-400">True Prob</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-400">Observed</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-400">True Odds</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-400">Observed RTP</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-400">Variance</th>
                      <th className="px-2 py-1.5 text-center text-xs font-semibold text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.cardResults.map((r, i) => (
                      <ResultRow
                        key={i}
                        label={HAND_LABELS[i]}
                        wins={r.wins}
                        observedProb={r.observedProb}
                        trueProb={r.trueProb}
                        trueOdds={r.trueOdds}
                        observedRtp={r.observedRtp}
                        dead={r.dead}
                        rtpLow={module.rtpLow}
                        rtpHigh={module.rtpHigh}
                        isLast={i === 9}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Rank Results */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Rank Position Results</h4>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-400">Position</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-400">Win Count</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-400">406 / Count</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-400">True Prob</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-400">Observed</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-400">True Odds</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-400">Observed RTP</th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-slate-400">Variance</th>
                      <th className="px-2 py-1.5 text-center text-xs font-semibold text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rankResults.map((r, i) => (
                      <ResultRow
                        key={i}
                        label={RANK_NAMES[i]}
                        wins={r.wins}
                        observedProb={r.observedProb}
                        trueProb={r.trueProb}
                        trueOdds={r.trueOdds}
                        observedRtp={r.observedRtp}
                        dead={r.dead}
                        rtpLow={module.rtpLow}
                        rtpHigh={module.rtpHigh}
                        isLast={i === 6}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">RTP Comparison by Target</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-2 py-1.5 text-left font-semibold text-slate-400">Position</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-400">Current Odds</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-400">For 100%</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-amber-300">Live Game</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-400">For 95%</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-400">For 96.5%</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-400">For 98%</th>
                        <th className="px-2 py-1.5 text-center font-semibold text-slate-400">Pass/Fail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.cardResults.map((r, i) => {
                        if (isThresholdDead(r.trueOdds, ODDS_THRESHOLD_CARD_HIGH, ODDS_THRESHOLD_CARD_LOW)) {
                          return (
                            <tr key={'c'+i} className="border-b border-slate-700/50 opacity-50">
                              <td className="px-2 py-1 text-slate-300">{HAND_LABELS[r.handId - 1]}</td>
                              <td className="px-2 py-1 text-right font-mono text-amber-300">{formatOdds(r.trueOdds)}</td>
                              <td className="px-2 py-1 text-right font-mono text-slate-600">DEAD</td>
                              <td className="px-2 py-1 text-right font-mono text-slate-600">DEAD</td>
                              <td className="px-2 py-1 text-right font-mono text-slate-600">DEAD</td>
                              <td className="px-2 py-1 text-right font-mono text-slate-600">DEAD</td>
                              <td className="px-2 py-1 text-right font-mono text-slate-600">DEAD</td>
                              <td className="px-2 py-1 text-center font-mono text-slate-500 font-bold">DEAD</td>
                            </tr>
                          );
                        }
                        const odds100 = r.trueProb > 0 ? (1 / r.trueProb) - 1 : null;
                        const oddsLiveCard = r.trueProb > 0 ? ((r.observedRtp / 100) / r.trueProb) - 1 : null;
                        const odds95 = r.trueProb > 0 ? (0.95 / r.trueProb) - 1 : null;
                        const odds965 = r.trueProb > 0 ? (0.965 / r.trueProb) - 1 : null;
                        const odds98 = r.trueProb > 0 ? (0.98 / r.trueProb) - 1 : null;
                        const pass = r.observedRtp >= module.rtpLow && r.observedRtp <= module.rtpHigh;
                        return (
                          <tr key={'c'+i} className="border-b border-slate-700/50">
                            <td className="px-2 py-1 text-slate-300">{HAND_LABELS[r.handId - 1]}</td>
                            <td className="px-2 py-1 text-right font-mono text-amber-300">{formatOdds(r.trueOdds)}</td>
                            <td className="px-2 py-1 text-right font-mono text-slate-300">{formatOdds(odds100)}</td>
                            <td className="px-2 py-1 text-right font-mono text-amber-300 font-semibold">{formatOdds(oddsLiveCard)}</td>
                            <td className="px-2 py-1 text-right font-mono text-slate-400">{formatOdds(odds95)}</td>
                            <td className="px-2 py-1 text-right font-mono text-slate-400">{formatOdds(odds965)}</td>
                            <td className="px-2 py-1 text-right font-mono text-slate-400">{formatOdds(odds98)}</td>
                            <td className="px-2 py-1 text-center font-mono">
                              {pass ? <span className="text-emerald-400 font-bold">PASS</span> : <span className="text-red-400 font-bold">FAIL</span>}
                            </td>
                          </tr>
                        );
                      })}
                      {result.rankResults.map((r, i) => {
                        if (isThresholdDead(r.trueOdds, ODDS_THRESHOLD_RANK_HIGH, ODDS_THRESHOLD_RANK_LOW)) {
                          return (
                            <tr key={'r'+i} className="border-b border-slate-700/50 opacity-50">
                              <td className="px-2 py-1 text-slate-300">{RANK_NAMES[r.rankIndex]}</td>
                              <td className="px-2 py-1 text-right font-mono text-amber-300">{formatOdds(r.trueOdds)}</td>
                              <td className="px-2 py-1 text-right font-mono text-slate-600">DEAD</td>
                              <td className="px-2 py-1 text-right font-mono text-slate-600">DEAD</td>
                              <td className="px-2 py-1 text-right font-mono text-slate-600">DEAD</td>
                              <td className="px-2 py-1 text-right font-mono text-slate-600">DEAD</td>
                              <td className="px-2 py-1 text-right font-mono text-slate-600">DEAD</td>
                              <td className="px-2 py-1 text-center font-mono text-slate-500 font-bold">DEAD</td>
                            </tr>
                          );
                        }
                        const odds100 = r.trueProb > 0 ? (1 / r.trueProb) - 1 : null;
                        const oddsLiveRank = r.trueProb > 0 ? ((r.observedRtp / 100) / r.trueProb) - 1 : null;
                        const odds95 = r.trueProb > 0 ? (0.95 / r.trueProb) - 1 : null;
                        const odds965 = r.trueProb > 0 ? (0.965 / r.trueProb) - 1 : null;
                        const odds98 = r.trueProb > 0 ? (0.98 / r.trueProb) - 1 : null;
                        const pass = r.observedRtp >= module.rtpLow && r.observedRtp <= module.rtpHigh;
                        return (
                          <tr key={'r'+i} className="border-b border-slate-700/50">
                            <td className="px-2 py-1 text-slate-300">{RANK_NAMES[r.rankIndex]}</td>
                            <td className="px-2 py-1 text-right font-mono text-amber-300">{formatOdds(r.trueOdds)}</td>
                            <td className="px-2 py-1 text-right font-mono text-slate-300">{formatOdds(odds100)}</td>
                            <td className="px-2 py-1 text-right font-mono text-amber-300 font-semibold">{formatOdds(oddsLiveRank)}</td>
                            <td className="px-2 py-1 text-right font-mono text-slate-400">{formatOdds(odds95)}</td>
                            <td className="px-2 py-1 text-right font-mono text-slate-400">{formatOdds(odds965)}</td>
                            <td className="px-2 py-1 text-right font-mono text-slate-400">{formatOdds(odds98)}</td>
                            <td className="px-2 py-1 text-center font-mono">
                              {pass ? <span className="text-emerald-400 font-bold">PASS</span> : <span className="text-red-400 font-bold">FAIL</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function OpenFlopCertificationAudit() {
  const [flopIndex, setFlopIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFlopList, setShowFlopList] = useState(false);
  const [rtpValue, setRtpValue] = useState(96.5);
  const listRef = useRef(null);

  // Card filter state — 3 dropdowns for selecting specific flop cards
  const [filterCards, setFilterCards] = useState([null, null, null]);
  const [openDropdown, setOpenDropdown] = useState(null); // 0, 1, 2, or null

  const flopData = useMemo(() => getFlopData(flopIndex), [flopIndex]);

  // Filter flops by search
  const filteredFlops = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    const results = [];
    for (let i = 0; i < TOTAL_FLOPS; i++) {
      const f = compactMatrix.flops[i];
      const cards = f[1] + ' ' + f[2] + ' ' + f[3];
      if (cards.toLowerCase().includes(term) || String(f[0]).includes(term)) {
        results.push({ index: i, id: f[0], cards: [f[1], f[2], f[3]] });
        if (results.length >= 50) break;
      }
    }
    return results;
  }, [searchTerm]);

  useEffect(() => {
    function handleClick(e) {
      // Scope BOTH closes to "outside the Select Flop container" — an unconditional
      // close on every mousedown was firing before the card button's own onClick
      // could register (mousedown fires before click), so selections never landed.
      if (listRef.current && !listRef.current.contains(e.target)) {
        setShowFlopList(false);
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Summary stats
  const summary = useMemo(() => {
    let deadCards = 0, deadRanks = 0;
    for (let i = 0; i < TOTAL_FLOPS; i++) {
      const f = compactMatrix.flops[i];
      for (let j = 5; j < 15; j++) if (f[j] === 0) deadCards++;
      for (let j = 15; j < 22; j++) if (f[j] === 0) deadRanks++;
    }
    return {
      total: TOTAL_FLOPS,
      cardPositions: TOTAL_FLOPS * 10,
      rankPositions: TOTAL_FLOPS * 7,
      deadCards,
      deadRanks,
      liveCards: TOTAL_FLOPS * 10 - deadCards,
      liveRanks: TOTAL_FLOPS * 7 - deadRanks,
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-amber-400" />
          <div>
            <h2 className="text-lg font-bold text-white">Open Flop Certification Audit</h2>
            <p className="text-xs text-slate-400">
              {summary.total.toLocaleString()} flops · {summary.liveCards.toLocaleString()} live card positions · {summary.liveRanks.toLocaleString()} live rank positions
            </p>
          </div>
        </div>
        <button
          onClick={() => downloadOpenFlopExcel(rtpValue)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-semibold text-white transition-colors"
        >
          <FileDown className="w-4 h-4" />
          Download Excel (RTP: {rtpValue}%)
        </button>
      </div>

      {/* RTP Control — Card & Rank Odds */}
      <div className="flex items-center gap-3 bg-slate-900/60 rounded-lg border border-slate-700 px-4 py-3">
        <span className="text-xs font-semibold text-slate-400">Card & Rank RTP:</span>
        <input
          type="number"
          min="80"
          max="100"
          step="0.1"
          value={rtpValue}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v >= 80 && v <= 100) setRtpValue(v);
          }}
          className="w-20 px-2 py-1 bg-slate-800 border border-amber-600/50 rounded-md text-sm font-bold text-amber-400 font-mono text-center focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        />
        <span className="text-sm font-bold text-amber-400 font-mono">%</span>
        <span className="text-xs text-slate-500">House Edge: {(100 - rtpValue).toFixed(1)}%</span>
      </div>

      {/* Flop Selector */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4" ref={listRef}>
        <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Select Flop</h3>
        <div className="flex items-center gap-3">
          {/* Card display */}
          <div className="flex items-center gap-2">
            {flopData.cards.map((card, i) => (
              <div key={i} className="w-14 h-20 rounded-lg bg-white flex items-center justify-center text-black font-bold text-lg shadow-lg" style={{
                color: (card.includes('♥') || card.includes('♦')) ? '#dc2626' : '#1e293b'
              }}>
                {card}
              </div>
            ))}
          </div>

          {/* Search + dropdown */}
          <div className="flex-1 relative">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by card (e.g., A♠) or flop number..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setShowFlopList(true); }}
                onFocus={() => setShowFlopList(true)}
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                Flop {flopData.flopId} / {TOTAL_FLOPS}
              </span>
            </div>

            {/* Dropdown list */}
            {showFlopList && (searchTerm || filteredFlops.length > 0) && (
              <div className="absolute top-full mt-1 left-0 right-0 max-h-64 overflow-y-auto bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50">
                {!searchTerm && (
                  <div className="p-2 text-xs text-slate-500">Type to search {TOTAL_FLOPS.toLocaleString()} flops...</div>
                )}
                {filteredFlops.map(f => (
                  <button
                    key={f.index}
                    onClick={() => { setFlopIndex(f.index); setShowFlopList(false); setSearchTerm(''); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <span className="font-mono">#{f.id}</span>
                    <span className="font-bold">{f.cards.join(' ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-1">
            <button
              onClick={() => setFlopIndex(Math.max(0, flopIndex - 1))}
              disabled={flopIndex === 0}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 disabled:opacity-40 text-xs text-slate-300 transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setFlopIndex(Math.min(TOTAL_FLOPS - 1, flopIndex + 1))}
              disabled={flopIndex === TOTAL_FLOPS - 1}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 disabled:opacity-40 text-xs text-slate-300 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Card filter — 3 mini-card dropdowns, same width as the cards above */}
        <div className="mt-3 flex items-center gap-2">
          {[0, 1, 2].map(slotIdx => {
            const selected = filterCards[slotIdx];
            const otherSlots = filterCards.filter((_, i) => i !== slotIdx);
            return (
              <div key={slotIdx} className="relative" style={{ zIndex: openDropdown === slotIdx ? 60 : 10 }}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === slotIdx ? null : slotIdx)}
                  className="w-14 h-20 rounded-lg bg-white flex flex-col items-center justify-center shadow-lg border-2 hover:border-amber-500 transition-colors"
                  style={{ borderColor: openDropdown === slotIdx ? '#f59e0b' : 'transparent' }}
                >
                  {selected ? (
                    <span className="font-bold text-lg" style={{ color: isRedCard(selected) ? '#dc2626' : '#1e293b' }}>
                      {selected}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[10px] italic leading-tight text-center px-1">Select<br/>card</span>
                  )}
                  <ChevronDown className="w-3 h-3 text-slate-400 mt-1" />
                </button>

                {openDropdown === slotIdx && (
                  <div className="absolute top-full mt-1 left-0 max-h-64 overflow-y-auto bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 min-w-[120px]">
                    {SORTED_CARD_POOL.map(card => {
                      const isTaken = otherSlots.includes(card);
                      return (
                        <button
                          key={card}
                          disabled={isTaken}
                          onClick={() => {
                            const next = [...filterCards];
                            next[slotIdx] = card;
                            setFilterCards(next);
                            setOpenDropdown(null);
                            // Auto-jump when all 3 selected
                            if (next[0] && next[1] && next[2]) {
                              const idx = findFlopByCards(next[0], next[1], next[2]);
                              if (idx >= 0) setFlopIndex(idx);
                            }
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors ${isTaken ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-700'}`}
                          style={{ color: isTaken ? '#475569' : isRedCard(card) ? '#dc2626' : '#f1f5f9' }}
                        >
                          <span className="font-bold">{card}</span>
                          {isTaken && <span className="text-xs text-slate-600">used</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Clear filters button */}
          {(filterCards[0] || filterCards[1] || filterCards[2]) && (
            <button
              onClick={() => setFilterCards([null, null, null])}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs text-slate-400 transition-colors self-center"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Certification Modules */}
      <div className="space-y-3">
        {MODULES.map(module => (
          <ModulePanel
            key={module.id}
            module={module}
            flopData={flopData}
            flopIndex={flopIndex}
          />
        ))}
      </div>
    </div>
  );
}