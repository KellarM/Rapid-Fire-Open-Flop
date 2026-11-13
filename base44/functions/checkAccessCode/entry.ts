// Entry codes for the studio's own domains.
//
// The code is checked here, on the server, and never in the page: the browser
// gets back a signed pass and nothing else, not the list, not a hint about how
// close a wrong guess was.
//
// Two sources of codes. The owner code lives below and never expires. Everyone
// else is issued in the app at /access-admin, where the name and the last day it
// works are recorded, and stored in the AccessCode entity. If that entity does
// not exist yet the function still works: it just has the owner code.

const OWNER_CODE = 'Qawsed01..';
const OWNER_NAME = 'Michael Kellar (owner)';

// Old-style hard-coded passes still work if any were handed out. Add one here
// only when you cannot use /access-admin.
const CODES: Array<{ code: string; name: string; expires: string | null }> = [];

// Change this and every pass already issued stops working: the fastest way to
// clear the building.
const PASS_SECRET = 'xfh-rapid-fire-2026-4f9c1a7e2b6d';

// A pass for a code with a date on it lives twelve hours, so a shared machine
// does not stay open. Your own code has no date, so its pass is longer: nobody
// should have to retype it twice a day.
const PASS_HOURS_DATED = 12;
const PASS_HOURS_OPEN = 24 * 30;

const MAX_FAILURES = 8;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;

const failures = new Map<string, { count: number; first: number }>();

function tidy(value: unknown): string {
  // Spaces and dashes are forgiven: people paste codes, retype them from an
  // email, and add a dash where there wasn't one. Case is ignored too.
  return String(value || '').replace(/[\s-]+/g, '').toUpperCase();
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(PASS_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64url(new Uint8Array(mac));
}

function tooManyFailures(ip: string): boolean {
  const record = failures.get(ip);
  if (!record) return false;
  if (Date.now() - record.first > FAILURE_WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return record.count >= MAX_FAILURES;
}

function noteFailure(ip: string): void {
  const record = failures.get(ip);
  if (!record || Date.now() - record.first > FAILURE_WINDOW_MS) {
    failures.set(ip, { count: 1, first: Date.now() });
    return;
  }
  record.count += 1;
}

type Pass = { code: string; name: string; expires: string | null };

async function findCode(attempted: string): Promise<Pass | null> {
  if (tidy(OWNER_CODE) === attempted) {
    return { code: OWNER_CODE, name: OWNER_NAME, expires: null };
  }

  const hardCoded = CODES.find((entry) => tidy(entry.code) === attempted);
  if (hardCoded) return hardCoded;

  try {
    const rows: any[] = await (globalThis as any).base44.asServiceRole.entities.AccessCode.list();
    const row = (rows || []).find(
      (record: any) => record?.active !== false && tidy(record?.code) === attempted
    );
    if (row) {
      return {
        code: String(row.code || ''),
        name: String(row.name || 'Guest'),
        expires: row.expires ? String(row.expires) : null,
      };
    }
  } catch {
    // The entity has not been created yet, or the lookup failed. The owner code
    // above still works, so the door is never locked out.
  }

  return null;
}

// A date with no time means the whole of that day, UTC.
function expiryMs(value: string | null): number | null {
  if (!value) return null;
  const raw = value.length <= 10 ? `${value}T23:59:59Z` : value;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: false }, { status: 405 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';

  if (tooManyFailures(ip)) {
    return Response.json(
      { ok: false, error: 'Too many attempts. Try again in ten minutes.' },
      { status: 429 }
    );
  }

  let attempted = '';
  try {
    const body = await req.json();
    attempted = tidy(body?.code);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  if (!attempted) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const match = await findCode(attempted);

  // No code, an expired code and a withdrawn code all get the same answer, so a
  // guess never learns whether it was close.
  if (!match) {
    noteFailure(ip);
    return Response.json({ ok: false }, { status: 200 });
  }

  const dead = expiryMs(match.expires);
  if (dead !== null && dead <= Date.now()) {
    noteFailure(ip);
    return Response.json({ ok: false }, { status: 200 });
  }

  const lifeMs = (dead === null ? PASS_HOURS_OPEN : PASS_HOURS_DATED) * 60 * 60 * 1000;
  const passExpiry = new Date(dead === null ? Date.now() + lifeMs : Math.min(dead, Date.now() + lifeMs));

  const payload = `${match.name}|${passExpiry.toISOString()}`;
  const token = `${base64url(new TextEncoder().encode(payload))}.${await sign(payload)}`;

  // One line per entry, so the app's logs answer "who came in, and when" without
  // any analytics bolted onto the game.
  try {
    await (globalThis as any).base44.asServiceRole.entities.AccessLog.create({
      name: match.name,
      code_hint: attempted.slice(0, 3) + '…',
      entered_at: new Date().toISOString(),
      expires: passExpiry.toISOString(),
    });
  } catch {
    // Logging is a convenience, never a gate.
  }

  return Response.json({
    ok: true,
    name: match.name,
    expires: passExpiry.toISOString(),
    token,
  });
});