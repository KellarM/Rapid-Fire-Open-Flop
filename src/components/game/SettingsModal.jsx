import React, { useState, useEffect } from 'react';
import { X, Volume2, VolumeX, BarChart2, BookOpen, HelpCircle, RotateCcw } from 'lucide-react';
import { useGameSounds } from '@/lib/game/useGameSounds';
import { formatMoney } from '@/lib/game/cards';

const COLORS = [
  { id: 'red',   label: 'Red',   dot: '#b30000' },
  { id: 'blue',  label: 'Blue',  dot: '#0a2a6e' },
  { id: 'green', label: 'Green', dot: '#0a4a1e' },
];

const BANK_RESET_OPTIONS = [20, 50, 100];
const BANK_RESET_STORAGE_KEY = 'rfpf_bank_reset_amount';

function loadBankResetAmount() {
  try {
    const raw = localStorage.getItem(BANK_RESET_STORAGE_KEY);
    const v = raw ? parseFloat(raw) : 20;
    return BANK_RESET_OPTIONS.includes(v) ? v : 20;
  } catch { return 20; }
}
function saveBankResetAmount(value) {
  try { localStorage.setItem(BANK_RESET_STORAGE_KEY, String(value)); } catch {}
}

const OVERLAY = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.7)',
  zIndex: 200,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const PANEL = {
  background: 'linear-gradient(160deg, #0d1f3c 0%, #071228 100%)',
  border: '1.5px solid #C5A059',
  borderRadius: 14,
  width: 380,
  maxWidth: '95vw',
  padding: '18px 20px 16px',
  maxHeight: '90vh',
  overflowY: 'hidden',
  boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};
const GOLD     = '#C5A059';
const GOLD_DARK = '#3d3013';
const GOLD_BTN = 'linear-gradient(135deg, #e5c158 0%, #d4af37 50%, #bf953f 100%)';

function StatRow({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(197,160,89,0.12)' }}>
      <span style={{ color: '#8a9ab0', fontSize: 13 }}>{label}</span>
      <span style={{ color: highlight || '#FFD700', fontWeight: 700, fontSize: 13 }}>{value}</span>
    </div>
  );
}

export default function SettingsModal({ isOpen, onClose, playerStats = {}, boardTheme = 'blue', setBoardTheme, onHowToPlay, onGameRules, onResetBank, onMobileLayout }) {
  const sounds = useGameSounds();
  const [crowdOn, setCrowdOn] = useState(true);
  const [crowdVolume, setCrowdVolume] = useState(40);
  const [tab, setTab] = useState('sound');
  const [bankResetAmount, setBankResetAmount] = useState(loadBankResetAmount);

  const handleBankResetAmountChange = (value) => {
    setBankResetAmount(value);
    saveBankResetAmount(value);
  };

  useEffect(() => {
    if (isOpen) {
      setCrowdVolume(Math.round(sounds.getCrowdVolume() * 100));
      setCrowdOn(sounds.isCrowdEnabled());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCrowdToggle = () => {
    const next = !crowdOn;
    setCrowdOn(next);
    sounds.setCrowdEnabled(next);
  };

  const handleCrowdVolume = (e) => {
    const v = Number(e.target.value);
    setCrowdVolume(v);
    sounds.setCrowdVolume(v / 100);
  };

  const stats = playerStats || {};
  const totalBets    = stats.totalBets    || 0;
  const totalWins    = stats.totalWins    || 0;
  const roundsPlayed = stats.roundsPlayed || 0;
  const roundsWon    = stats.roundsWon    || 0;
  const profit   = totalWins - totalBets;
  const roi      = totalBets > 0 ? ((profit / totalBets) * 100).toFixed(1) : '0.0';
  const winRate  = roundsPlayed > 0 ? ((roundsWon / roundsPlayed) * 100).toFixed(0) : '0';
  const avgBet   = roundsPlayed > 0 ? (totalBets / roundsPlayed).toFixed(2) : '0.00';
  const bestMult = stats.highestMultiplier || 0;

  return (
    <div style={OVERLAY} onClick={onClose}>
      <div style={PANEL} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: GOLD, fontWeight: 800, fontSize: 17, letterSpacing: '1px' }}>SETTINGS</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GOLD }}>
            <X size={20} />
          </button>
        </div>

        {/* Board Color */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(197,160,89,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            BOARD COLOR
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {COLORS.map(t => (
              <button key={t.id}
                onClick={() => setBoardTheme && setBoardTheme(t.id)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                  fontWeight: 700, fontSize: 12,
                  color: boardTheme === t.id ? '#fde047' : '#94a3b8',
                  border: boardTheme === t.id ? '2px solid #facc15' : '1px solid rgba(197,160,89,0.3)',
                  background: boardTheme === t.id ? 'rgba(100,60,0,0.55)' : 'rgba(0,0,0,0.3)',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: t.dot, border: '2px solid rgba(255,255,255,0.25)',
                  display: 'block',
                }} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bank Reset Amount */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(197,160,89,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            RESET BANK AMOUNT
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {BANK_RESET_OPTIONS.map(value => (
              <button key={value}
                onClick={() => handleBankResetAmountChange(value)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                  fontWeight: 700, fontSize: 13,
                  color: bankResetAmount === value ? '#fde047' : '#94a3b8',
                  border: bankResetAmount === value ? '2px solid #facc15' : '1px solid rgba(197,160,89,0.3)',
                  background: bankResetAmount === value ? 'rgba(100,60,0,0.55)' : 'rgba(0,0,0,0.3)',
                  transition: 'all 0.15s',
                }}
              >
                ${value}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { id: 'sound',      icon: <Volume2    size={14} />, label: 'Sound'       },
            { id: 'stats',      icon: <BarChart2  size={14} />, label: 'Player Stats'},
            { id: 'gamerules',  icon: <BookOpen   size={14} />, label: 'Game Rules'  },
            { id: 'howtoplay',  icon: <HelpCircle size={14} />, label: 'How to Play' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => t.id === 'howtoplay' ? (onHowToPlay && onHowToPlay()) : t.id === 'gamerules' ? (onGameRules && onGameRules()) : setTab(t.id)}
              style={{
                flex: '0 0 calc(50% - 3px)', padding: '6px 0', borderRadius: 8,
                background: tab === t.id ? GOLD_BTN : 'rgba(197,160,89,0.1)',
                border: `1px solid ${tab === t.id ? GOLD : 'rgba(197,160,89,0.3)'}`,
                color: tab === t.id ? GOLD_DARK : GOLD,
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Sound Tab */}
        {tab === 'sound' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* ── CROWD / AMBIENT — independent channel ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: 'rgba(197,160,89,0.07)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {crowdOn ? <Volume2 size={20} color={GOLD} /> : <VolumeX size={20} color="#6a7a8a" />}
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>Crowd Sound</div>
                    <div style={{ color: '#8a9ab0', fontSize: 11 }}>Ambient poker room background</div>
                  </div>
                </div>
                <button
                  onClick={handleCrowdToggle}
                  style={{ width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: crowdOn ? '#22c55e' : '#374151', position: 'relative', transition: 'background 0.2s' }}
                >
                  <div style={{ position: 'absolute', top: 3, left: crowdOn ? 23 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
                </button>
              </div>
              {/* Crowd volume slider */}
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ color: '#8a9ab0', fontSize: 11, fontWeight: 600 }}>Crowd Volume</span>
                  <span style={{ color: GOLD, fontWeight: 800, fontSize: 12 }}>{crowdVolume}%</span>
                </div>
                <input
                  type="range" min={0} max={100} value={crowdVolume}
                  onChange={handleCrowdVolume}
                  disabled={!crowdOn}
                  style={{ width: '100%', height: 6, accentColor: GOLD, opacity: crowdOn ? 1 : 0.4, cursor: crowdOn ? 'pointer' : 'not-allowed' }}
                />
              </div>
            </div>

          </div>
        )}

        {/* Stats Tab */}
        {tab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <StatRow label="Rounds Played"   value={roundsPlayed} />
            <StatRow label="Rounds Won"      value={roundsWon} />
            <StatRow label="Win Rate"        value={`${winRate}%`} />
            <StatRow label="Total Bets"      value={formatMoney(totalBets)} />
            <StatRow label="Total Wins"      value={formatMoney(totalWins)} />
            <StatRow label="Profit / Loss"   value={`${profit >= 0 ? '+' : ''}${formatMoney(profit)}`} highlight={profit >= 0 ? '#22c55e' : '#ef4444'} />
            <StatRow label="ROI"             value={`${roi}%`} highlight={Number(roi) >= 0 ? '#22c55e' : '#ef4444'} />
            <StatRow label="Avg Bet / Round" value={formatMoney(Number(avgBet))} />
            <StatRow label="Best Multiplier" value={bestMult > 0 ? `${bestMult.toFixed(1)}x` : '—'} />
            {stats.highestBalance != null && (
              <StatRow label="Peak Balance" value={formatMoney(stats.highestBalance)} highlight="#22c55e" />
            )}
          </div>
        )}


        {/* How To Play Tab */}
        {tab === 'howtoplay' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 14px', background: 'rgba(197,160,89,0.07)', borderRadius: 10, minHeight: 80, alignItems: 'center', justifyContent: 'center' }}>
            <HelpCircle size={28} color="rgba(197,160,89,0.4)" />
            <span style={{ color: 'rgba(197,160,89,0.5)', fontSize: 12, fontWeight: 600 }}>How To Play — Coming Soon</span>
          </div>
        )}

        {/* Close */}
        <button
          onClick={() => onResetBank && onResetBank(bankResetAmount)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(180,40,40,0.25)', color: '#ff6b6b', border: '1px solid #ff6b6b', borderRadius: 8, padding: '7px 0', fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: '0.5px' }}
          title={`Reset bankroll to $${bankResetAmount}, clear stats, and restore default sound settings`}
        >
          <RotateCcw size={15} /> RESET BANK TO ${bankResetAmount}
        </button>
        <button
          onClick={onClose}
          style={{ background: GOLD_BTN, color: GOLD_DARK, border: 'none', borderRadius: 8, padding: '7px 0', fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: '0.5px' }}
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}