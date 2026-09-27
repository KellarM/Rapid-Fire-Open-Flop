// RTP Verification Tool settings — operator-configurable.
//
// When enabled, the operator's target return is checked against the odds
// actually offered on the Card and Rank boards, position by position, after
// every flop. The target is ANALYTICAL ONLY — it never changes payouts,
// settlement or the house edge, so play is identical whether the tool is on
// or off.
//
// Mirrors the Cascade / Ante Structure persistence pattern: localStorage +
// cookie fallback for instant load, plus a custom event for live-sync to a
// running session. The server-side source of truth lives in the GameConfig
// entity (see the gameConfig backend function), so a change made on one
// device applies to every device once published.

const ENABLED_KEY = 'rfpf_rtp_enabled';
const CARD_KEY    = 'rfpf_rtp_card_target';
const RANK_KEY    = 'rfpf_rtp_rank_target';

export const DEFAULT_RTP_SETTINGS = { enabled: false, cardTarget: 96.5, rankTarget: 96.5 };

function writeCookie(name, value, days = 365) {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {}
}
function readCookie(name) {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}

// Targets are stored as percentages (96.5 = 96.5% RTP).
function normalize(raw) {
  const enabled = raw?.enabled === true;
  const cardTarget = Number(raw?.cardTarget);
  const rankTarget = Number(raw?.rankTarget);
  return {
    enabled,
    cardTarget: Number.isFinite(cardTarget) && cardTarget > 0 && cardTarget <= 100
      ? cardTarget : DEFAULT_RTP_SETTINGS.cardTarget,
    rankTarget: Number.isFinite(rankTarget) && rankTarget > 0 && rankTarget <= 100
      ? rankTarget : DEFAULT_RTP_SETTINGS.rankTarget,
  };
}

export function getSavedRtpSettings() {
  try {
    const raw = localStorage.getItem(ENABLED_KEY);
    if (raw !== null) {
      return normalize({
        enabled: raw === 'true',
        cardTarget: localStorage.getItem(CARD_KEY),
        rankTarget: localStorage.getItem(RANK_KEY),
      });
    }
  } catch {}
  const en = readCookie(ENABLED_KEY);
  if (en !== null) {
    return normalize({
      enabled: en === 'true',
      cardTarget: readCookie(CARD_KEY),
      rankTarget: readCookie(RANK_KEY),
    });
  }
  return { ...DEFAULT_RTP_SETTINGS };
}

export const RTP_EVENT = 'rfpf-rtp-changed';

export function saveRtpSettings(settings) {
  const clean = normalize(settings);
  try {
    localStorage.setItem(ENABLED_KEY, String(clean.enabled));
    localStorage.setItem(CARD_KEY, String(clean.cardTarget));
    localStorage.setItem(RANK_KEY, String(clean.rankTarget));
  } catch {}
  writeCookie(ENABLED_KEY, String(clean.enabled));
  writeCookie(CARD_KEY, String(clean.cardTarget));
  writeCookie(RANK_KEY, String(clean.rankTarget));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RTP_EVENT, { detail: clean }));
  }
  return clean;
}