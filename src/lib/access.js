// Entry passes for the studio's own domains.
//
// A pass is issued by the server, never by the page. The browser only holds what
// came back: who it was issued to, when it dies, and the token the server signed.
// The expiry is re-checked on every load, so a code that lapsed overnight stops
// working on the next refresh without anyone doing anything.

const STORAGE_KEY = 'xfh_entry_pass_v1';

// Held in sessionStorage rather than localStorage, so the pass dies with the tab.
// Every fresh visit to the link meets the cover page again; a refresh inside the
// tab being played does not, which matters because the game reloads its own route
// and nobody should lose their place mid-hand.

export function readPass() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const pass = JSON.parse(raw);
    if (!pass?.token || !pass?.expires) return null;
    if (new Date(pass.expires).getTime() <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return pass;
  } catch {
    return null;
  }
}

export function savePass(pass) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pass));
  } catch {
    // Storage blocked: the pass simply won't survive a refresh.
  }
  return pass;
}

export function clearPass() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}

// Typed by a person, so case, spaces and dashes are forgiven before it is sent.
// The server applies the same rule, so the two can never disagree.
export function tidyCode(value) {
  return String(value || '').replace(/[\s-]+/g, '').toUpperCase();
}
