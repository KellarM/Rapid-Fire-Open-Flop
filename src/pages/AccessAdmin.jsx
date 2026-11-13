import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { readPass, clearPass } from '@/lib/access';
import AccessGate from '@/pages/AccessGate';

const GOLD = '#e8b84b';
const INK = '#0b1220';

// Where passes are issued. Only the owner pass reaches this page: the name on the
// pass is signed by the server, so it cannot be typed in from the browser.
function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `XFH-${body.slice(0, 4)}-${body.slice(4)}`;
}

export default function AccessAdmin() {
  const pass = readPass();
  const isOwner = Boolean(pass?.name && String(pass.name).toLowerCase().includes('owner'));

  const [rows, setRows] = useState([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState(makeCode());
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [broken, setBroken] = useState('');

  const load = async () => {
    try {
      const list = await base44.entities.AccessCode.list('-created_date', 100);
      setRows(Array.isArray(list) ? list : []);
      setBroken('');
    } catch {
      setBroken('The AccessCode table does not exist in this app yet, so codes cannot be saved.');
    }
  };

  useEffect(() => {
    if (isOwner) load();
  }, [isOwner]);

  if (!isOwner) {
    // Straight into the cover page rather than a dead end: enter the owner code
    // and the reload lands back here with the pass in place.
    return <AccessGate onUnlock={() => window.location.reload()} />;
  }

  if (false) {
    return (
      <div className="min-h-screen px-6 py-20 text-slate-200" style={{ backgroundColor: INK }}>
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-semibold text-white">Not available</h1>
          <p className="mt-3 text-slate-400">
            This page issues entry codes. It opens with the owner pass only.
          </p>
          <button
            type="button"
            onClick={() => {
              clearPass();
              window.location.href = '/';
            }}
            className="mt-6 rounded-lg px-5 py-2.5 text-sm font-bold text-slate-950"
            style={{ backgroundColor: GOLD }}
          >
            Back to the door
          </button>
        </div>
      </div>
    );
  }

  const add = async (event) => {
    event.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setBusy(true);
    setNote('');
    try {
      await base44.entities.AccessCode.create({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        expires: expires || null,
        active: true,
      });
      setName('');
      setExpires('');
      setCode(makeCode());
      await load();
      setNote('Code saved. Send it with the date, and it stops working that night.');
    } catch {
      setNote('Could not save. Check the AccessCode table exists and try again.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (row) => {
    try {
      await base44.entities.AccessCode.update(row.id, { active: !row.active });
      await load();
    } catch {
      setNote('Could not change that code.');
    }
  };

  return (
    <div className="min-h-screen px-6 py-12 text-slate-200" style={{ backgroundColor: INK }}>
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: GOLD }}>
          XFH Game Studio
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Entry codes</h1>
        <p className="mt-2 text-[15px] text-slate-400">
          One code per person, each with the last day it works. Withdraw a code the moment it
          should stop, without waiting for the date.
        </p>

        <form onSubmit={add} className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Who it is for
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Marina A. (BGaming)"
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[15px] text-slate-100 placeholder:text-slate-600 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Code
              </span>
              <div className="mt-2 flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-[15px] tracking-wider text-slate-100 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setCode(makeCode())}
                  className="rounded-lg border border-slate-700 px-3 text-[13px] text-slate-300"
                  title="Make a new code"
                >
                  New
                </button>
              </div>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Last day it works
              </span>
              <input
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[15px] text-slate-100 focus:outline-none"
              />
              <span className="mt-1 block text-[12px] text-slate-500">
                Leave empty for a code that never expires.
              </span>
            </label>
          </div>
          <button
            type="submit"
            disabled={busy || !name.trim() || !code.trim()}
            className="mt-5 rounded-lg px-6 py-2.5 text-[15px] font-bold text-slate-950 disabled:opacity-40"
            style={{ backgroundColor: GOLD }}
          >
            {busy ? 'Saving…' : 'Create code'}
          </button>
          {note && <p className="mt-3 text-[14px]" style={{ color: GOLD }}>{note}</p>}
          {broken && <p className="mt-3 text-[14px] text-red-400">{broken}</p>}
        </form>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-slate-900/80 text-[11px] uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Last day</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-slate-500">
                    No codes issued yet.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-slate-200">{row.name}</td>
                  <td className="px-4 py-3 font-mono tracking-wider text-slate-300">{row.code}</td>
                  <td className="px-4 py-3 text-slate-400">{row.expires || 'Never'}</td>
                  <td className="px-4 py-3">
                    <span style={{ color: row.active === false ? '#f87171' : '#4ade80' }}>
                      {row.active === false ? 'Withdrawn' : 'Live'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggle(row)}
                      className="rounded-md border border-slate-700 px-3 py-1.5 text-[13px] text-slate-300"
                    >
                      {row.active === false ? 'Restore' : 'Withdraw'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-[13px] text-slate-500">
          Your own code never expires and is not listed here. It is set in the server function, so
          nobody can read it from the game.
        </p>
      </div>
    </div>
  );
}
