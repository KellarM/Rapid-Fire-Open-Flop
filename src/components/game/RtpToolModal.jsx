import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { DEALER_STOCK } from '@/lib/game/cards';
import { getSavedRtpSettings, saveRtpSettings } from '@/lib/game/rtpTool';
import {
  computeRtpAudit, checkPosition, previewPayout, meanTrueReturn,
  getRtpSnapshot, subscribeRtpSnapshot,
} from '@/lib/game/rtpVerification';
import RtpReadout from './RtpReadout';
import { Activity } from 'lucide-react';

const GOLD = '#e5c158';
const GOLD_BRIGHT = '#FFD700';
const GREEN = '#4ade80';
const MUTED = '#8a8a8a';

// ── RTP Tool (Operator Tool) ────────────────────────────────────────────────
// Sets the target return for the Card and Rank boards and turns the live
// verification badges on or off. The target is analytical only — it judges the
// odds on offer, it never changes them. Stored server-side (GameConfig) so a
// change applies to every device.
export default function RtpToolModal({ onClose }) {
  const saved = useMemo(() => getSavedRtpSettings(), []);
  const [enabled, setEnabled] = useState(saved.enabled);
  const [cardTarget, setCardTarget] = useState(saved.cardTarget);
  const [rankTarget, setRankTarget] = useState(saved.rankTarget);
  const [active, setActive] = useState(saved.enabled);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [snapshot, setSnapshot] = useState(() => getRtpSnapshot());

  useEffect(() => subscribeRtpSnapshot(setSnapshot), []);

  const audit = useMemo(() => {
    if (!snapshot) return null;
    return computeRtpAudit(snapshot.flop, DEALER_STOCK, snapshot.cardOdds, snapshot.rankOdds);
  }, [snapshot]);

  const cardRows = useMemo(() => {
    if (!audit) return [];
    return audit.card.map(r => {
      const chk = r.locked ? null : checkPosition(r.probability, r.payout, cardTarget);
      return {
        key: `card-${r.handId}`,
        label: r.label,
        locked: r.locked,
        offered: r.payout,
        preview: previewPayout(r.probability, cardTarget),
        ok: chk ? chk.ok : null,
      };
    });
  }, [audit, cardTarget]);

  const rankRows = useMemo(() => {
    if (!audit) return [];
    return audit.rank.map(r => {
      const chk = r.locked ? null : checkPosition(r.probability, r.payout, rankTarget);
      return {
        key: `rank-${r.label}`,
        label: r.label,
        locked: r.locked,
        offered: r.payout,
        preview: previewPayout(r.probability, rankTarget),
        ok: chk ? chk.ok : null,
      };
    });
  }, [audit, rankTarget]);

  const parseTarget = (raw, fallback) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 && n <= 100 ? n : fallback;
  };

  const handleSave = async () => {
    const card = parseTarget(cardTarget, 96.5);
    const rank = parseTarget(rankTarget, 96.5);
    setSaving(true);
    try {
      await base44.functions.invoke('gameConfig', {
        action: 'set',
        rtpToolEnabled: enabled,
        cardRtpTarget: card,
        rankRtpTarget: rank,
      });
    } catch (e) {
      // Server unavailable: fall back to local-only so the operator's session
      // still reflects the change (it will sync on the next successful set).
    }
    const clean = saveRtpSettings({ enabled, cardTarget: card, rankTarget: rank });
    setCardTarget(clean.cardTarget);
    setRankTarget(clean.rankTarget);
    setActive(clean.enabled);
    setSavedFlash(true);
    setSaving(false);
  };

  const inputStyle = {
    width: 84, padding: '8px 10px', textAlign: 'center',
    background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(197,160,89,0.4)',
    borderRadius: 7, color: GOLD_BRIGHT, fontWeight: 800, fontSize: 14,
    outline: 'none',
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
              <Activity size={16} color="#1a0f00" />
            </div>
            <span style={{
              fontSize: 15, fontWeight: 900, color: '#facc15',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              RTP
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
          <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.55 }}>
            Verifies the Card and Rank boards against a target return. The badge on each
            betting position goes green when the odds on offer return the target and red
            when they don't. This is an analytical check only — payouts, settlement and
            gameplay are unchanged whether the switch is on or off.
          </div>

          {/* On / off switch */}
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
              RTP Verification
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

          {/* Targets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Card Board Target', value: cardTarget, set: setCardTarget },
              { label: 'Rank Board Target', value: rankTarget, set: setRankTarget },
            ].map(f => (
              <div key={f.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, padding: '12px 14px', borderRadius: 10,
                border: '1px solid rgba(197,160,89,0.25)', background: 'rgba(0,0,0,0.3)',
              }}>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>{f.label}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={0.1}
                    value={f.value}
                    onChange={(e) => { f.set(e.target.value === '' ? '' : Number(e.target.value)); setSavedFlash(false); }}
                    style={inputStyle}
                  />
                  <span style={{ color: MUTED, fontSize: 13, fontWeight: 700 }}>%</span>
                </span>
              </div>
            ))}
          </div>

          {/* Live justification for the hand in play */}
          {audit ? (
            <RtpReadout
              card={{ total: audit.total, boardWinProb: audit.boardWinProb, rows: cardRows, trueReturn: meanTrueReturn(audit.card) }}
              rank={{ total: audit.total, boardWinProb: audit.boardWinProb, rows: rankRows, trueReturn: meanTrueReturn(audit.rank) }}
              cardTarget={parseTarget(cardTarget, 96.5)}
              rankTarget={parseTarget(rankTarget, 96.5)}
            />
          ) : (
            <div style={{
              padding: '22px 16px', borderRadius: 10, textAlign: 'center',
              border: '1px dashed rgba(197,160,89,0.3)', background: 'rgba(0,0,0,0.25)',
              color: MUTED, fontSize: 11, lineHeight: 1.5,
            }}>
              No flop in play. Deal a hand and the live justification for the
              current flop appears here.
            </div>
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
            Active: <b style={{ color: active ? GREEN : MUTED }}>{active ? 'ON' : 'OFF'}</b>
            {' · '}
            <b style={{ color: GOLD }}>{parseTarget(cardTarget, 96.5).toFixed(2)}%</b> card
            {' · '}
            <b style={{ color: GOLD }}>{parseTarget(rankTarget, 96.5).toFixed(2)}%</b> rank
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