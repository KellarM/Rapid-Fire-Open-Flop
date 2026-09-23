import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Wrench, Layers, Shuffle } from 'lucide-react';
import { fetchCapturedHands, recalcHandRtp, recalcPayout } from '../../lib/captureApi';
import { ANTE_STRUCTURES, getSavedStructureId, saveStructureId } from '../../lib/game/anteStructures';
import { DEFAULT_BONUS_MULTIPLIERS, getSavedBonusMultipliers, saveBonusMultipliers } from '../../lib/game/bonusMultipliers';
import { getSavedCascadeEnabled, saveCascadeEnabled } from '../../lib/game/cascadeBetting';
import { base44 } from '@/api/base44Client';

// ── Inject toolbar animations once ───────────────────────────────────────────
const STYLE_ID = 'rf-toolbar-style';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes rf-menu-slide-down {
      from { opacity: 0; transform: translateY(-10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .rf-tool-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      background: linear-gradient(135deg, #1a0f00 0%, #0e0800 100%);
      border: 1px solid rgba(197,160,89,0.5);
      border-radius: 6px;
      color: #e5c158;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      padding: 9px 14px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      text-transform: uppercase;
    }
    .rf-tool-btn:hover {
      background: linear-gradient(135deg, #2a1a00 0%, #1a1000 100%);
      border-color: #e5c158;
      color: #FFD700;
    }
    .rf-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: rgba(255,255,255,0.1);
      outline: none;
    }
    .rf-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: linear-gradient(135deg, #e5c158 0%, #d4af37 100%);
      cursor: pointer;
      border: 2px solid #1a0f00;
    }
    .rf-slider::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #e5c158;
      cursor: pointer;
      border: 2px solid #1a0f00;
    }
  `;
  document.head.appendChild(s);
}

// ── Color helpers ────────────────────────────────────────────────────────────
const GOLD = '#e5c158';
const GOLD_BRIGHT = '#FFD700';
const GREEN = '#4ade80';
const RED = '#f87171';
const MUTED = '#8a8a8a';
const BODY_TEXT = '#c4b896';

function pct(v) { return `${(v * 100).toFixed(2)}%`; }
function pct1(v) { return `${(v * 100).toFixed(1)}%`; }

// ── Certification Test Modal ──────────────────────────────────────────────────
function CertificationTestModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('history');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // HE adjustment state (0–1 range)
  const [heCard, setHeCard] = useState(0.15);
  const [heRank, setHeRank] = useState(0.12);
  const [heColor, setHeColor] = useState(0.04); // LOCKED — not user-adjustable

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchCapturedHands();
    if (result.error) {
      setError(result.error);
    } else {
      setData(result);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Calculate adjusted accumulated RTPs
  let adjustedThreeBoard = 0;
  let adjustedTotal = 0;
  if (data && data.hands && data.hands.length > 0) {
    let sum3 = 0, sum4 = 0;
    data.hands.forEach(h => {
      const r = recalcHandRtp(h, heCard, heRank);
      sum3 += r.threeBoardBlended;
      sum4 += r.totalBlended;
    });
    adjustedThreeBoard = sum3 / data.hands.length;
    adjustedTotal = sum4 / data.hands.length;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'linear-gradient(160deg, #1a0f00 0%, #0a0600 100%)',
        border: '2px solid rgba(202,138,4,0.7)',
        borderRadius: 16,
        width: 680,
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 12px 60px rgba(0,0,0,0.95)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 22px',
          borderBottom: '1px solid rgba(202,138,4,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #e5c158 0%, #d4af37 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 16 }}>⚙</span>
            </div>
            <span style={{
              fontSize: 15, fontWeight: 900, color: '#facc15',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Certification Test Suite
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              color: '#facc15', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 20, lineHeight: 1, opacity: 0.8,
            }}
          >✕</button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex', gap: 2, padding: '8px 22px 0',
          borderBottom: '1px solid rgba(202,138,4,0.2)',
          flexShrink: 0,
        }}>
          {[
            { id: 'history', label: 'Captured Hands' },
            { id: 'calculator', label: 'RTP Calculator' },
            { id: 'status', label: 'Cert Status' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? 'rgba(202,138,4,0.15)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${GOLD}` : '2px solid transparent',
                color: activeTab === tab.id ? GOLD_BRIGHT : MUTED,
                fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '8px 16px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '18px 22px', flex: 1 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: MUTED, fontSize: 13 }}>
              Loading captured hands…
            </div>
          )}
          {error && (
            <div style={{ textAlign: 'center', padding: 40, color: RED, fontSize: 13 }}>
              Error: {error}
            </div>
          )}
          {!loading && !error && activeTab === 'history' && (
            <HistoryTab data={data} onRefresh={loadData} />
          )}
          {!loading && !error && activeTab === 'calculator' && (
            <CalculatorTab
              data={data}
              heCard={heCard} setHeCard={setHeCard}
              heRank={heRank} setHeRank={setHeRank}
              heColor={heColor} setHeColor={setHeColor}
              adjustedThreeBoard={adjustedThreeBoard}
              adjustedTotal={adjustedTotal}
            />
          )}
          {!loading && !error && activeTab === 'status' && (
            <StatusTab />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 22px',
          borderTop: '1px solid rgba(202,138,4,0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ color: MUTED, fontSize: 10 }}>
            {data ? `${data.totalHands || 0} hands captured` : ''}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, #e5c158 0%, #d4af37 100%)',
              color: '#3d3013', fontWeight: 800, fontSize: 12,
              letterSpacing: '0.08em', padding: '8px 24px',
              borderRadius: 7, border: 'none', cursor: 'pointer',
            }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ante Structure Modal (Operator Tool) ────────────────────────────────────
// Lets the operator select which Ante Bonus threshold structure is active.
// Selection is staged until SAVE is pressed, then stored in localStorage and
// live-synced to any running game session via a custom event.
function AnteStructureModal({ onClose }) {
  const [selectedId, setSelectedId] = useState(() => getSavedStructureId());
  const [activeId, setActiveId]     = useState(() => getSavedStructureId());
  const [savedFlash, setSavedFlash] = useState(false);

  const handleSelect = (id) => {
    setSelectedId(id);
    setSavedFlash(false);
  };

  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      // Server-side source of truth — applies to every device once published.
      await base44.functions.invoke('gameConfig', { action: 'set', anteStructureId: selectedId });
    } catch (e) {
      // Server unavailable: fall back to local-only so the operator's
      // session still reflects the change (will sync on next successful set).
    }
    // Local cache + live-sync event for the running session.
    saveStructureId(selectedId);
    setActiveId(selectedId);
    setSavedFlash(true);
    setSaving(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'linear-gradient(160deg, #1a0f00 0%, #0a0600 100%)',
        border: '2px solid rgba(202,138,4,0.7)',
        borderRadius: 16,
        width: 640,
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 12px 60px rgba(0,0,0,0.95)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 22px',
          borderBottom: '1px solid rgba(202,138,4,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #e5c158 0%, #d4af37 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Layers size={16} color="#1a0f00" />
            </div>
            <span style={{
              fontSize: 15, fontWeight: 900, color: '#facc15',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Ante Structure
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              color: '#facc15', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 20, lineHeight: 1, opacity: 0.8,
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '18px 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>
            Qualifier: player must bet the full Ante on ONE position per board and win it for that board to count.
            Select a structure, then press SAVE to apply. Changes go live to the current session
            (GLI-21: allow idle time before switching mid-shift).
          </div>

          {ANTE_STRUCTURES.map(s => {
            const isSelected = selectedId === s.id;
            const isActive   = activeId   === s.id;
            return (
              <button
                key={s.id}
                onClick={() => handleSelect(s.id)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: isSelected ? '2px solid #facc15' : '1px solid rgba(197,160,89,0.25)',
                  background: isSelected ? 'rgba(100,60,0,0.55)' : 'rgba(0,0,0,0.3)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: isSelected ? '#fde047' : '#fff', fontWeight: 800, fontSize: 13 }}>
                    {s.id}: {s.name}
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {isActive && (
                      <span style={{ fontSize: 9, color: GOLD_BRIGHT, fontWeight: 700, background: 'rgba(202,138,4,0.15)', padding: '2px 6px', borderRadius: 4 }}>ACTIVE</span>
                    )}
                    {s.viable
                      ? <span style={{ fontSize: 9, color: GREEN, fontWeight: 700, background: 'rgba(34,197,94,0.15)', padding: '2px 6px', borderRadius: 4 }}>VIABLE</span>
                      : <span style={{ fontSize: 9, color: RED, fontWeight: 700, background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: 4 }}>PLAYER EDGE</span>
                    }
                  </div>
                </div>
                <div style={{ fontSize: 11, color: BODY_TEXT }}>{s.short}</div>
                {/* RTP bar chart */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, Math.max(0, s.blendedRtp))}%`,
                      height: '100%',
                      borderRadius: 3,
                      background: s.blendedRtp > 100
                        ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                        : s.blendedRtp >= 95
                          ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                          : 'linear-gradient(90deg, #f59e0b, #d97706)',
                    }} />
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 800, minWidth: 62, textAlign: 'right',
                    color: s.blendedRtp > 100 ? RED : s.blendedRtp >= 95 ? GREEN : '#f59e0b',
                  }}>
                    {s.blendedRtp.toFixed(2)}% RTP
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 10, color: MUTED }}>
                  <span>Ante RTP: <b style={{ color: BODY_TEXT }}>{s.anteRtp.toFixed(2)}%</b></span>
                  <span>House Edge: <b style={{ color: s.houseEdge >= 0 ? GREEN : RED }}>{s.houseEdge >= 0 ? '+' : ''}{s.houseEdge.toFixed(2)}%</b></span>
                </div>
              </button>
            );
          })}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'rgba(197,160,89,0.5)', paddingTop: 6, borderTop: '1px solid rgba(202,138,4,0.2)' }}>
            <span>🟢 95–100% RTP</span>
            <span>🟡 85–95% RTP</span>
            <span>🔴 &gt;100% (player edge — non-viable)</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 22px',
          borderTop: '1px solid rgba(202,138,4,0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ color: MUTED, fontSize: 10 }}>
            Active: <b style={{ color: GOLD_BRIGHT }}>{ANTE_STRUCTURES.find(s => s.id === activeId)?.name || activeId}</b>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {savedFlash && (
              <span style={{ color: GREEN, fontSize: 10, fontWeight: 700 }}>SAVED ✓</span>
            )}
            <button
              onClick={handleSave}
              style={{
                background: 'linear-gradient(135deg, #e5c158 0%, #d4af37 100%)',
                color: '#3d3013', fontWeight: 800, fontSize: 12,
                letterSpacing: '0.08em', padding: '8px 24px',
                borderRadius: 7, border: 'none', cursor: 'pointer',
              }}
            >
              SAVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bonus Multiplier Modal (Operator Tool) ──────────────────────────────────
// Lets the operator manually set the gross RNG Bonus multiplier for each of
// the 3 bonus areas. "Gross" = total payout multiple on the winning bet
// (e.g. 5 means the position pays out at 5x total on that bonus draw).
// Selection is stored in localStorage and live-synced to any running game
// session via a custom event (see bonusMultipliers.js / useGame.js).
function BonusMultiplierModal({ onClose }) {
  const [values, setValues] = useState(() => getSavedBonusMultipliers());
  const [savedFlash, setSavedFlash] = useState(false);

  const LINES = [
    { key: 'card', label: 'Card Hands', desc: '10 positions — bonus draw picks 1 of 10' },
    { key: 'rank', label: 'Rank Hands', desc: '7 positions — bonus draw picks 1 of 7' },
    { key: 'colorRiver', label: 'Color & River', desc: '8 positions — 6 Color + 2 River' },
  ];

  const handleChange = (key, raw) => {
    const num = raw === '' ? '' : Number(raw);
    setValues(v => ({ ...v, [key]: num }));
    setSavedFlash(false);
  };

  const handleSave = () => {
    console.log('[ToolBar] handleSave: raw values state =', JSON.parse(JSON.stringify(values)));
    const clean = {
      card: Number.isFinite(values.card) && values.card >= 1 ? values.card : DEFAULT_BONUS_MULTIPLIERS.card,
      rank: Number.isFinite(values.rank) && values.rank >= 1 ? values.rank : DEFAULT_BONUS_MULTIPLIERS.rank,
      colorRiver: Number.isFinite(values.colorRiver) && values.colorRiver >= 1 ? values.colorRiver : DEFAULT_BONUS_MULTIPLIERS.colorRiver,
    };
    console.log('[ToolBar] handleSave: clean =', clean);
    const saved = saveBonusMultipliers(clean);
    setValues(saved);
    setSavedFlash(true);
  };

  const handleResetDefaults = () => {
    const saved = saveBonusMultipliers(DEFAULT_BONUS_MULTIPLIERS);
    setValues(saved);
    setSavedFlash(true);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'linear-gradient(160deg, #1a0f00 0%, #0a0600 100%)',
        border: '2px solid rgba(202,138,4,0.7)',
        borderRadius: 16,
        width: 520,
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 12px 60px rgba(0,0,0,0.95)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 22px',
          borderBottom: '1px solid rgba(202,138,4,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #e5c158 0%, #d4af37 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 16 }}>×</span>
            </div>
            <span style={{
              fontSize: 15, fontWeight: 900, color: '#facc15',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Bonus Multiplier
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              color: '#facc15', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 20, lineHeight: 1, opacity: 0.8,
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '18px 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 11, color: MUTED }}>
            Set the gross multiplier for each RNG Bonus area — enter the TOTAL payout multiple
            on the winning bet (e.g. 5 = position pays 5x total). Changes apply live to the
            current session. For testing purposes only until values are re-certified.
          </div>

          {LINES.map(line => (
            <div key={line.key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 14, padding: '12px 14px',
              borderRadius: 10, border: '1px solid rgba(197,160,89,0.25)',
              background: 'rgba(0,0,0,0.3)',
            }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>{line.label}</div>
                <div style={{ color: BODY_TEXT, fontSize: 10, marginTop: 2 }}>{line.desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  value={values[line.key]}
                  onChange={(e) => handleChange(line.key, e.target.value)}
                  style={{
                    width: 64, padding: '8px 10px', textAlign: 'center',
                    background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(197,160,89,0.4)',
                    borderRadius: 7, color: GOLD_BRIGHT, fontWeight: 800, fontSize: 14,
                    outline: 'none',
                  }}
                />
                <span style={{ color: MUTED, fontSize: 13, fontWeight: 700 }}>×</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 22px',
          borderTop: '1px solid rgba(202,138,4,0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <button
            onClick={handleResetDefaults}
            style={{
              background: 'rgba(202,138,4,0.15)',
              border: `1px solid ${GOLD}66`,
              color: GOLD, fontSize: 11, fontWeight: 700,
              padding: '8px 16px', borderRadius: 7, cursor: 'pointer',
            }}
          >
            RESET DEFAULTS
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {savedFlash && (
              <span style={{ color: GREEN, fontSize: 10, fontWeight: 700 }}>SAVED ✓</span>
            )}
            <button
              onClick={handleSave}
              style={{
                background: 'linear-gradient(135deg, #e5c158 0%, #d4af37 100%)',
                color: '#3d3013', fontWeight: 800, fontSize: 12,
                letterSpacing: '0.08em', padding: '8px 24px',
                borderRadius: 7, border: 'none', cursor: 'pointer',
              }}
            >
              SAVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ data, onRefresh }) {
  if (!data || !data.hands || data.hands.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ color: MUTED, fontSize: 13, marginBottom: 16 }}>No hands captured yet.</div>
        <div style={{ color: '#666', fontSize: 11, marginBottom: 20 }}>
          Play hands in the game — each resolved round is automatically captured.
        </div>
        <button onClick={onRefresh} style={{
          background: 'rgba(202,138,4,0.15)',
          border: `1px solid ${GOLD}66`,
          color: GOLD, fontSize: 11, fontWeight: 700,
          padding: '8px 20px', borderRadius: 7, cursor: 'pointer',
        }}>
          REFRESH
        </button>
      </div>
    );
  }

  const { totalHands, hands, averages } = data;

  return (
    <div>
      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatBox label="Total Hands" value={totalHands} />
        <StatBox label="3-Board Blended" value={pct(averages.threeBoardBlended)} color={averages.threeBoardBlended >= 0.85 ? GREEN : GOLD} />
        <StatBox label="Full Blended (w/ River)" value={pct(averages.totalBlended)} color={averages.totalBlended >= 0.88 ? GREEN : GOLD} />
      </div>

      {/* Hand History Table */}
      <div style={{
        border: '1px solid rgba(197,160,89,0.2)',
        borderRadius: 8, overflow: 'hidden',
      }}>
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 100px 50px 50px 1fr 70px 70px',
          background: 'rgba(202,138,4,0.08)',
          padding: '8px 10px',
          fontSize: 9, fontWeight: 800, color: GOLD,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          borderBottom: '1px solid rgba(197,160,89,0.2)',
        }}>
          <span>#</span>
          <span>Flop</span>
          <span>Turn</span>
          <span>River</span>
          <span>Winners</span>
          <span style={{ textAlign: 'right' }}>3-Board</span>
          <span style={{ textAlign: 'right' }}>Total</span>
        </div>

        {/* Data rows */}
        {hands.slice(0, 50).map((h, i) => {
          const cardInfo = h.cardWinners && h.cardWinners.length > 0
            ? h.cardWinners.map(w => `H${w.handIndex}`).join(',')
            : 'BOARD';
          const rankInfo = h.rankWinners && h.rankWinners.length > 0
            ? h.rankWinners[0].position
            : '—';
          const colorInfo = h.colorWinners && h.colorWinners.length > 0
            ? h.colorWinners[0].position
            : '—';
          const riverInfo = h.riverWinners && h.riverWinners.length > 0
            ? h.riverWinners[0].position.toUpperCase()
            : '—';

          return (
            <div key={h.id || i} style={{
              display: 'grid',
              gridTemplateColumns: '40px 100px 50px 50px 1fr 70px 70px',
              padding: '7px 10px',
              fontSize: 10, color: BODY_TEXT,
              borderBottom: i < hands.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <span style={{ color: MUTED }}>{h.handNumber || i + 1}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{h.flopCards || '—'}</span>
              <span style={{ fontFamily: 'monospace' }}>{h.turnCard || '—'}</span>
              <span style={{ fontFamily: 'monospace' }}>{h.riverCard || '—'}</span>
              <span style={{ fontSize: 9 }}>
                {cardInfo} · {rankInfo} · {colorInfo} · {riverInfo}
              </span>
              <span style={{ textAlign: 'right', color: h.threeBoardRtp >= 0.8 ? GREEN : h.threeBoardRtp < 0.5 ? RED : GOLD, fontWeight: 700, fontSize: 10 }}>
                {pct1(h.threeBoardRtp)}
              </span>
              <span style={{ textAlign: 'right', color: h.totalRtp >= 0.8 ? GREEN : h.totalRtp < 0.5 ? RED : GOLD, fontWeight: 700, fontSize: 10 }}>
                {pct1(h.totalRtp)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Most Recent Hand Detail */}
      {hands[0] && <HandDetail hand={hands[0]} />}

      <div style={{ marginTop: 12 }}>
        <button onClick={onRefresh} style={{
          background: 'rgba(202,138,4,0.15)',
          border: `1px solid ${GOLD}66`,
          color: GOLD, fontSize: 11, fontWeight: 700,
          padding: '8px 20px', borderRadius: 7, cursor: 'pointer',
        }}>
          REFRESH DATA
        </button>
      </div>
    </div>
  );
}

function HandDetail({ hand }) {
  const boards = [
    { name: 'Card Board', winners: hand.cardWinners, he: '15%' },
    { name: 'Rank Board', winners: hand.rankWinners, he: '12%' },
    { name: 'Color Board', winners: hand.colorWinners, he: '4% (LOCKED)' },
    { name: 'River Board', winners: hand.riverWinners, he: '8% (LOCKED)' },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ color: GOLD, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 8 }}>
        MOST RECENT HAND — PER-POSITION DETAIL
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {boards.map(b => (
          <div key={b.name} style={{
            padding: '10px 12px', borderRadius: 8,
            background: 'rgba(255,215,0,0.04)',
            border: '1px solid rgba(197,160,89,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: GOLD, fontSize: 10, fontWeight: 700 }}>{b.name}</span>
              <span style={{ color: MUTED, fontSize: 9 }}>HE: {b.he}</span>
            </div>
            {b.winners && b.winners.length > 0 ? b.winners.map((w, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, fontSize: 9 }}>
                <div>
                  <span style={{ color: MUTED }}>Pos: </span>
                  <span style={{ color: BODY_TEXT }}>{b.name === 'Card Board' ? `H${w.handIndex}` : w.position}</span>
                </div>
                <div>
                  <span style={{ color: MUTED }}>P: </span>
                  <span style={{ color: BODY_TEXT }}>{pct1(w.probability)}</span>
                </div>
                <div>
                  <span style={{ color: MUTED }}>Pay: </span>
                  <span style={{ color: BODY_TEXT }}>{w.payout?.toFixed(3)}:1</span>
                </div>
                <div>
                  <span style={{ color: MUTED }}>RTP: </span>
                  <span style={{ color: w.rtp >= 0.9 ? GREEN : GOLD, fontWeight: 700 }}>{pct1(w.rtp)}</span>
                </div>
              </div>
            )) : (
              <div style={{ color: RED, fontSize: 10 }}>BOARD WON — no position paid</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Calculator Tab ──────────────────────────────────────────────────────────
function CalculatorTab({ data, heCard, setHeCard, heRank, setHeRank, heColor, setHeColor, adjustedThreeBoard, adjustedTotal }) {
  const originalHE = { card: 0.15, rank: 0.12, color: 0.04 };
  const hasData = data && data.hands && data.hands.length > 0;

  // Use most recent hand for per-position display
  const recentHand = hasData ? data.hands[0] : null;

  return (
    <div>
      {/* HE Sliders */}
      <div style={{ color: GOLD, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', marginBottom: 14, textTransform: 'uppercase' }}>
        House Edge Adjustment — 2 Adjustable Boards (Card & Rank)
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
        <HESlider label="Card Board" value={heCard} onChange={setHeCard} original={originalHE.card} />
        <HESlider label="Rank Board" value={heRank} onChange={setHeRank} original={originalHE.rank} />
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: GOLD, fontSize: 11, fontWeight: 700 }}>Color Board</span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 700 }}>RTP: 96.0%</span>
              <span style={{ color: BODY_TEXT, fontSize: 14, fontWeight: 800 }}>HE: 4.0%</span>
              <span style={{ color: MUTED, fontSize: 9 }}>LOCKED — 4 pre-certified states</span>
            </div>
          </div>
        </div>
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: MUTED, fontSize: 10 }}>River Board</span>
            <span style={{ color: BODY_TEXT, fontSize: 11, fontWeight: 700 }}>HE: 8% (FIXED — not adjustable)</span>
          </div>
        </div>
      </div>

      {/* Blended RTP Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div style={{
          padding: '14px', borderRadius: 10,
          background: 'rgba(255,215,0,0.06)',
          border: '1px solid rgba(197,160,89,0.3)',
        }}>
          <div style={{ color: GOLD, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 6 }}>3-BOARD BLENDED RTP</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div>
              <div style={{ color: MUTED, fontSize: 9 }}>Original</div>
              <div style={{ color: BODY_TEXT, fontSize: 18, fontWeight: 800 }}>
                {hasData ? pct(data.averages.threeBoardBlended) : '—'}
              </div>
            </div>
            <div style={{ fontSize: 14, color: MUTED }}>→</div>
            <div>
              <div style={{ color: MUTED, fontSize: 9 }}>Adjusted</div>
              <div style={{ color: GOLD_BRIGHT, fontSize: 18, fontWeight: 900 }}>
                {hasData ? pct(adjustedThreeBoard) : '—'}
              </div>
            </div>
          </div>
        </div>
        <div style={{
          padding: '14px', borderRadius: 10,
          background: 'rgba(255,215,0,0.06)',
          border: '1px solid rgba(197,160,89,0.3)',
        }}>
          <div style={{ color: GOLD, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 6 }}>FULL BLENDED RTP (w/ RIVER)</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div>
              <div style={{ color: MUTED, fontSize: 9 }}>Original</div>
              <div style={{ color: BODY_TEXT, fontSize: 18, fontWeight: 800 }}>
                {hasData ? pct(data.averages.totalBlended) : '—'}
              </div>
            </div>
            <div style={{ fontSize: 14, color: MUTED }}>→</div>
            <div>
              <div style={{ color: MUTED, fontSize: 9 }}>Adjusted</div>
              <div style={{ color: GOLD_BRIGHT, fontSize: 18, fontWeight: 900 }}>
                {hasData ? pct(adjustedTotal) : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-Board RTP Summary */}
      <div style={{ color: GOLD, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', marginBottom: 10, textTransform: 'uppercase' }}>
        Per-Board RTP (Adjusted)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
        <BoardRtpBox label="Card" rtp={1 - heCard} boardWin={recentHand && (!recentHand.cardWinners || recentHand.cardWinners.length === 0)} />
        <BoardRtpBox label="Rank" rtp={1 - heRank} boardWin={recentHand && (!recentHand.rankWinners || recentHand.rankWinners.length === 0)} />
        <BoardRtpBox label="Color" rtp={0.96} fixed />
        <BoardRtpBox label="River" rtp={1 - 0.08} fixed />
      </div>

      {/* Recent Hand Position Detail with Adjusted Payouts */}
      {recentHand && (
        <div>
          <div style={{ color: GOLD, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 8 }}>
            MOST RECENT HAND — ADJUSTED ODDS PREVIEW
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <AdjustedBoard
              name="Card Board"
              winners={recentHand.cardWinners}
              he={heCard}
              posLabel={w => `H${w.handIndex}`}
            />
            <AdjustedBoard
              name="Rank Board"
              winners={recentHand.rankWinners}
              he={heRank}
              posLabel={w => w.position}
            />
            <AdjustedBoard
              name="Color Board"
              winners={recentHand.colorWinners}
              he={0.04}
              posLabel={w => w.position}
              fixed
            />
            <AdjustedBoard
              name="River Board"
              winners={recentHand.riverWinners}
              he={0.08}
              posLabel={w => w.position.toUpperCase()}
              fixed
            />
          </div>
        </div>
      )}

      {!hasData && (
        <div style={{ textAlign: 'center', padding: 30, color: MUTED, fontSize: 12 }}>
          No captured hands yet. Play hands to see adjusted odds calculations.
        </div>
      )}
    </div>
  );
}

function HESlider({ label, value, onChange, original }) {
  const changed = Math.abs(value - original) > 0.001;
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8,
      background: 'rgba(255,215,0,0.04)',
      border: `1px solid ${changed ? GOLD : 'rgba(197,160,89,0.2)'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: GOLD, fontSize: 11, fontWeight: 700 }}>{label}</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          <span style={{ color: MUTED, fontSize: 9 }}>
            Original: {(original * 100).toFixed(0)}%
          </span>
          <span style={{
            color: changed ? GOLD_BRIGHT : BODY_TEXT,
            fontSize: 14, fontWeight: 800,
          }}>
            HE: {(value * 100).toFixed(1)}%
          </span>
          <span style={{
            color: 1 - value >= 0.9 ? GREEN : 1 - value >= 0.8 ? GOLD : RED,
            fontSize: 12, fontWeight: 700,
          }}>
            RTP: {((1 - value) * 100).toFixed(1)}%
          </span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={0.25}
        step={0.005}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="rf-slider"
      />
    </div>
  );
}

function BoardRtpBox({ label, rtp, boardWin, fixed }) {
  const displayRtp = boardWin ? 0 : rtp;
  return (
    <div style={{
      padding: '10px', borderRadius: 8,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      textAlign: 'center',
    }}>
      <div style={{ color: MUTED, fontSize: 9, fontWeight: 700, marginBottom: 4 }}>{label}{fixed ? ' (fixed)' : ''}</div>
      <div style={{
        color: boardWin ? RED : displayRtp >= 0.9 ? GREEN : displayRtp >= 0.8 ? GOLD : RED,
        fontSize: 18, fontWeight: 900,
      }}>
        {boardWin ? '0.0%' : pct1(displayRtp)}
      </div>
      {boardWin && <div style={{ color: RED, fontSize: 8, marginTop: 2 }}>BOARD WON</div>}
    </div>
  );
}

function AdjustedBoard({ name, winners, he, posLabel, fixed }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8,
      background: 'rgba(255,215,0,0.04)',
      border: '1px solid rgba(197,160,89,0.2)',
    }}>
      <div style={{ color: GOLD, fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
        {name}{fixed ? ' (FIXED)' : ''}
      </div>
      {winners && winners.length > 0 ? winners.map((w, i) => {
        const newPayout = fixed ? w.payout : recalcPayout(w.probability, he);
        return (
          <div key={i} style={{ fontSize: 9, lineHeight: 1.8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: MUTED }}>Position</span>
              <span style={{ color: BODY_TEXT }}>{posLabel(w)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: MUTED }}>Probability</span>
              <span style={{ color: BODY_TEXT }}>{pct1(w.probability)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: MUTED }}>Orig Payout</span>
              <span style={{ color: BODY_TEXT }}>{w.payout?.toFixed(3)}:1</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: MUTED }}>{fixed ? 'Payout' : 'New Payout'}</span>
              <span style={{ color: fixed ? BODY_TEXT : GOLD_BRIGHT, fontWeight: 700 }}>{newPayout?.toFixed(3)}:1</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: MUTED }}>RTP</span>
              <span style={{ color: (1 - he) >= 0.9 ? GREEN : GOLD, fontWeight: 700 }}>
                {pct1(1 - he)}
              </span>
            </div>
          </div>
        );
      }) : (
        <div style={{ color: RED, fontSize: 10 }}>BOARD WON — no position paid</div>
      )}
    </div>
  );
}

// ── Status Tab ──────────────────────────────────────────────────────────────
function StatusTab() {
  const items = [
    { item: 'Math Engine — Open Flop Odds', status: 'VERIFIED', color: GREEN },
    { item: 'RTP Formula Correctness', status: 'VERIFIED', color: GREEN },
    { item: 'Lockout Logic (80% threshold)', status: 'VERIFIED', color: GREEN },
    { item: 'Color Board Dynamic Odds', status: 'VERIFIED', color: GREEN },
    { item: 'Auto-Capture System', status: 'ACTIVE', color: GREEN },
    { item: 'RTP Calculator (HE Adjustment)', status: 'ACTIVE', color: GREEN },
    { item: 'Full Enumeration Report', status: 'PENDING', color: '#facc15' },
    { item: 'Monte Carlo Simulation Report', status: 'PENDING', color: '#facc15' },
    { item: 'GLI / BMM Submission', status: 'NOT STARTED', color: RED },
  ];

  return (
    <div>
      <div style={{ color: GOLD, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', marginBottom: 14, textTransform: 'uppercase' }}>
        Certification Status
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(({ item, status, color }) => (
          <div key={item} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderRadius: 6,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ color: '#c4b896', fontSize: 11 }}>{item}</span>
            <span style={{ color, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em' }}>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatBox({ label, value, color }) {
  return (
    <div style={{
      padding: '12px', borderRadius: 8,
      background: 'rgba(255,215,0,0.04)',
      border: '1px solid rgba(197,160,89,0.2)',
      textAlign: 'center',
    }}>
      <div style={{ color: MUTED, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color: color || GOLD_BRIGHT, fontSize: 20, fontWeight: 900 }}>
        {value}
      </div>
    </div>
  );
}

// ── Cascade Betting Modal (Operator Tool) ───────────────────────────────────
// Toggles Cascade Betting: when ON, the Color board's maximum bet becomes the
// sum of the Card + Rank board bets (instead of the Ante). When OFF, betting
// is unchanged. Stored server-side (GameConfig) so it applies to every device.
function CascadeModal({ onClose }) {
  const [enabled, setEnabled] = useState(() => getSavedCascadeEnabled());
  const [active, setActive] = useState(() => getSavedCascadeEnabled());
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('gameConfig', { action: 'set', cascadeEnabled: enabled });
    } catch (e) {
      // Server unavailable: fall back to local-only.
    }
    saveCascadeEnabled(enabled);
    setActive(enabled);
    setSavedFlash(true);
    setSaving(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'linear-gradient(160deg, #1a0f00 0%, #0a0600 100%)',
        border: '2px solid rgba(202,138,4,0.7)',
        borderRadius: 16,
        width: 520,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 12px 60px rgba(0,0,0,0.95)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 22px',
          borderBottom: '1px solid rgba(202,138,4,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #e5c158 0%, #d4af37 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shuffle size={16} color="#1a0f00" />
            </div>
            <span style={{
              fontSize: 15, fontWeight: 900, color: '#facc15',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Cascade Betting
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              color: '#facc15', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 20, lineHeight: 1, opacity: 0.8,
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 11, color: MUTED }}>
            When <b style={{ color: BODY_TEXT }}>ON</b>, the Color board's maximum bet becomes the
            sum of the Card board bet + the Hand Rank board bet (instead of the Ante). When
            <b style={{ color: BODY_TEXT }}> OFF</b>, all board bets remain capped at the Ante as they are today.
          </div>

          <button
            onClick={() => { setEnabled(e => !e); setSavedFlash(false); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
              border: '1px solid rgba(197,160,89,0.4)',
              background: enabled ? 'rgba(34,197,94,0.12)' : 'rgba(0,0,0,0.3)',
            }}
          >
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>
              Cascade Betting
            </span>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800,
              color: enabled ? GREEN : MUTED,
            }}>
              {enabled ? 'ON' : 'OFF'}
              <span style={{
                width: 44, height: 24, borderRadius: 12,
                background: enabled ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.12)',
                position: 'relative', transition: 'background 0.2s',
              }}>
                <span style={{
                  position: 'absolute', top: 3, left: enabled ? 23 : 3,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                }} />
              </span>
            </span>
          </button>
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 22px',
          borderTop: '1px solid rgba(202,138,4,0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ color: MUTED, fontSize: 10 }}>
            Active: <b style={{ color: active ? GREEN : MUTED }}>{active ? 'ON' : 'OFF'}</b>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {savedFlash && (
              <span style={{ color: GREEN, fontSize: 10, fontWeight: 700 }}>SAVED ✓</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: 'linear-gradient(135deg, #e5c158 0%, #d4af37 100%)',
                color: '#3d3013', fontWeight: 800, fontSize: 12,
                letterSpacing: '0.08em', padding: '8px 24px',
                borderRadius: 7, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'SAVING…' : 'SAVE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ToolBar Component ────────────────────────────────────────────────────
export default function ToolBar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showCertTest, setShowCertTest] = useState(false);
  const [showAnteStructure, setShowAnteStructure] = useState(false);
  const [showBonusMultiplier, setShowBonusMultiplier] = useState(false);
  const [showCascade, setShowCascade] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const [visible, setVisible] = useState(false); // hidden by default -- summoned via hotkey only
  const btnRef = useRef(null);

  // ── Hotkey: Ctrl+Alt+J+L toggles visibility of the entire Tools button ──────
  // Tracks 'j'/'l' as physically-held keys (via a Set) and reads ctrlKey/altKey
  // directly off the event for the modifiers. Fires once per full press (guarded
  // by toggledRef), resetting the guard as soon as any required key is released.
  const heldKeysRef = useRef(new Set());
  const toggledRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'j' || k === 'l') heldKeysRef.current.add(k);
      const comboActive = e.ctrlKey && e.altKey
        && heldKeysRef.current.has('j') && heldKeysRef.current.has('l');
      if (comboActive && !toggledRef.current) {
        toggledRef.current = true;
        setVisible(v => {
          const next = !v;
          if (!next) { setOpen(false); } // hiding the button also closes any open menu
          return next;
        });
      }
    };
    const handleKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'j' || k === 'l') heldKeysRef.current.delete(k);
      if (!e.ctrlKey || !e.altKey || heldKeysRef.current.size === 0) {
        toggledRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useLayoutEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        left: rect.left,
        top: rect.bottom + 8,
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      const menuEl = document.getElementById('rf-toolbar-portal-menu');
      if (menuEl && menuEl.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!visible) return null; // hidden until summoned by Ctrl+Alt+J+L

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <button
          ref={btnRef}
          onClick={() => setOpen(o => !o)}
          title="Operator Tools"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 5,
            height: 34,
            padding: '0 12px',
            background: open
              ? 'linear-gradient(135deg, #2a1a00 0%, #1a1000 100%)'
              : 'linear-gradient(135deg, #1a0f00 0%, #0e0800 100%)',
            border: `1px solid ${open ? '#e5c158' : 'rgba(197,160,89,0.5)'}`,
            borderRadius: 6,
            color: open ? '#FFD700' : '#e5c158',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          <Wrench size={14} />
          <span style={{
            fontSize: 10, fontWeight: 800,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            TOOLS
          </span>
        </button>
      </div>

      {open && menuPos && typeof document !== 'undefined' && createPortal(
        <div
          id="rf-toolbar-portal-menu"
          style={{
            position: 'fixed',
            left: menuPos.left,
            top: menuPos.top,
            minWidth: 200,
            background: 'linear-gradient(160deg, #1a0f00 0%, #0a0600 100%)',
            border: '1px solid rgba(202,138,4,0.6)',
            borderRadius: 10,
            padding: '8px',
            display: 'flex', flexDirection: 'column', gap: 6,
            boxShadow: '0 8px 32px rgba(0,0,0,0.9)',
            zIndex: 9999,
            animation: 'rf-menu-slide-down 0.18s ease-out',
          }}
        >
          <div style={{
            color: 'rgba(229,193,88,0.6)', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '2px 6px 6px',
            borderBottom: '1px solid rgba(202,138,4,0.2)',
            marginBottom: 2,
          }}>
            OPERATOR TOOLS
          </div>

          <button
            className="rf-tool-btn"
            onClick={() => { setOpen(false); setShowCertTest(true); }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 5,
              background: 'linear-gradient(135deg, #e5c158 0%, #d4af37 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 12,
            }}>⚙</span>
            CERTIFICATION TEST
          </button>

          <button
            className="rf-tool-btn"
            onClick={() => { setOpen(false); navigate('/open-flop-certification'); }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 5,
              background: 'linear-gradient(135deg, #e5c158 0%, #d4af37 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 12,
            }}>📊</span>
            POST FLOP POSSIBILITIES
          </button>

          <button
            className="rf-tool-btn"
            onClick={() => { setOpen(false); setShowAnteStructure(true); }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 5,
              background: 'linear-gradient(135deg, #e5c158 0%, #d4af37 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}><Layers size={12} color="#1a0f00" /></span>
            ANTE STRUCTURE
          </button>

          <button
            className="rf-tool-btn"
            onClick={() => { setOpen(false); setShowBonusMultiplier(true); }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 5,
              background: 'linear-gradient(135deg, #e5c158 0%, #d4af37 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 13, fontWeight: 900, color: '#1a0f00',
            }}>×</span>
            BONUS MULTIPLIER
          </button>

          <button
            className="rf-tool-btn"
            onClick={() => { setOpen(false); setShowCascade(true); }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 5,
              background: 'linear-gradient(135deg, #e5c158 0%, #d4af37 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}><Shuffle size={12} color="#1a0f00" /></span>
            CASCADE
          </button>

          <div style={{
            color: 'rgba(197,160,89,0.3)', fontSize: 9, fontWeight: 600,
            letterSpacing: '0.08em', textAlign: 'center',
            padding: '4px 0 2px',
          }}>
            MORE TOOLS COMING
          </div>
        </div>,
        document.body
      )}

      {showCertTest && typeof document !== 'undefined' && createPortal(
        <CertificationTestModal onClose={() => setShowCertTest(false)} />,
        document.body
      )}

      {showAnteStructure && typeof document !== 'undefined' && createPortal(
        <AnteStructureModal onClose={() => setShowAnteStructure(false)} />,
        document.body
      )}

      {showBonusMultiplier && typeof document !== 'undefined' && createPortal(
        <BonusMultiplierModal onClose={() => setShowBonusMultiplier(false)} />,
        document.body
      )}

      {showCascade && typeof document !== 'undefined' && createPortal(
        <CascadeModal onClose={() => setShowCascade(false)} />,
        document.body
      )}
    </>
  );
}