// Cascade Betting toggle — operator-configurable.
// When ON, the Color board's maximum bet becomes the sum of the Card board
// bet + the Hand Rank board bet (instead of the Ante). When OFF, all board
// bets remain capped at the Ante (original behavior).
//
// Mirrors the Ante Structure / Bonus Multiplier persistence pattern:
// localStorage + cookie fallback for instant load, plus a custom event for
// live-sync to a running game session. The server-side source of truth lives
// in the GameConfig entity (see the gameConfig backend function), so a change
// made on one device applies to every device once published.

const STORAGE_KEY = 'rfpf_cascade_enabled';
const COOKIE_KEY = 'rfpf_cascade_enabled';

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

export function getSavedCascadeEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) return raw === 'true';
  } catch {}
  const ck = readCookie(COOKIE_KEY);
  if (ck !== null) return ck === 'true';
  return false;
}

export const CASCADE_EVENT = 'rfpf-cascade-changed';

export function saveCascadeEnabled(value) {
  const v = value === true;
  try { localStorage.setItem(STORAGE_KEY, String(v)); } catch {}
  writeCookie(COOKIE_KEY, String(v));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CASCADE_EVENT, { detail: v }));
  }
  return v;
}