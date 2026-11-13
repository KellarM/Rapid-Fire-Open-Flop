import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { savePass, tidyCode } from '@/lib/access';

// The front door for the studio's domains. Nothing behind it renders until the
// server has accepted a code, so a visitor cannot open the game, the simulation
// pages or the deck inspector by guessing a URL.
//
// The look is the entrance to a private gaming room rather than a login box: brass
// rules, a felted table surface, one plaque to enter a code. Everything is CSS, so
// it loads with the page and there is nothing to fetch.

const GOLD = '#d9b166';
const GOLD_BRIGHT = '#f0d79a';

export default function AccessGate({ onUnlock }) {
  const [code, setCode] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const { data } = await base44.functions.invoke('checkAccessCode', {
        code: tidyCode(code),
      });
      if (!data?.ok || !data?.token) {
        // One message for a wrong code, an expired code and a code that never
        // existed. The page must never confirm a near miss.
        setError('That code is not valid, or it has expired.');
      } else {
        onUnlock(savePass({ token: data.token, expires: data.expires, name: data.name }));
      }
    } catch {
      setError('Could not reach the studio. Check your connection and try again.');
    }
    setBusy(false);
  };

  return (
    <div className="xfh-entrance">
      <style>{`
        .xfh-entrance {
          --gold: ${GOLD};
          --gold-bright: ${GOLD_BRIGHT};
          --felt: #0c2e26;
          --ink: #07090b;
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 18px 56px;
          background:
            radial-gradient(120% 90% at 50% -10%, rgba(217,177,102,0.16) 0%, rgba(217,177,102,0) 55%),
            radial-gradient(90% 70% at 50% 120%, rgba(12,46,38,0.85) 0%, rgba(7,9,11,0) 60%),
            linear-gradient(180deg, #0a0d10 0%, #07090b 55%, #060809 100%);
          color: #eae4d8;
          font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* the felt, faint enough to read through */
        .xfh-entrance::before {
          content: '';
          position: absolute;
          inset: -10%;
          background-image:
            repeating-linear-gradient(45deg, rgba(255,255,255,0.014) 0 2px, transparent 2px 5px),
            repeating-linear-gradient(-45deg, rgba(0,0,0,0.05) 0 2px, transparent 2px 6px);
          opacity: 0.6;
          pointer-events: none;
        }

        /* light falling from the ceiling */
        .xfh-entrance::after {
          content: '';
          position: absolute;
          top: -30%;
          left: 50%;
          width: 120%;
          height: 70%;
          transform: translateX(-50%);
          background: radial-gradient(closest-side, rgba(240,215,154,0.10), rgba(240,215,154,0) 70%);
          pointer-events: none;
        }

        /* The hall itself: a European gaming room at night, held well back so the
           plaque reads first and the room is atmosphere rather than subject. */
        .xfh-hall {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(115% 85% at 50% 6%, rgba(0,0,0,0) 38%, rgba(3,5,6,0.62) 100%),
            linear-gradient(180deg, rgba(6,9,11,0.26) 0%, rgba(4,7,8,0.44) 60%, rgba(3,5,6,0.72) 100%),
            url('/casino-hall.jpg') center 42%/cover no-repeat;
          animation: xfh-drift 48s ease-in-out infinite alternate;
          pointer-events: none;
        }

        @keyframes xfh-drift {
          from { transform: scale(1.02); }
          to   { transform: scale(1.09); }
        }

        @media (prefers-reduced-motion: reduce) {
          .xfh-hall { animation: none; }
        }

        .xfh-frame {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 720px;
          padding: 46px 30px 34px;
          border: 1px solid rgba(217,177,102,0.30);
          background:
            linear-gradient(180deg, rgba(12,20,22,0.86) 0%, rgba(8,12,14,0.92) 100%);
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.6),
            0 30px 80px -20px rgba(0,0,0,0.9),
            inset 0 1px 0 rgba(240,215,154,0.10);
          backdrop-filter: blur(1px);
        }

        /* brass inner rule, the way a table is inlaid */
        .xfh-frame::before {
          content: '';
          position: absolute;
          inset: 9px;
          border: 1px solid rgba(217,177,102,0.16);
          pointer-events: none;
        }

        .xfh-corner {
          position: absolute;
          width: 22px;
          height: 22px;
          border-color: var(--gold);
          opacity: 0.75;
          pointer-events: none;
        }
        .xfh-corner.tl { top: 2px; left: 2px; border-top: 1px solid; border-left: 1px solid; }
        .xfh-corner.tr { top: 2px; right: 2px; border-top: 1px solid; border-right: 1px solid; }
        .xfh-corner.bl { bottom: 2px; left: 2px; border-bottom: 1px solid; border-left: 1px solid; }
        .xfh-corner.br { bottom: 2px; right: 2px; border-bottom: 1px solid; border-right: 1px solid; }

        .xfh-suits {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          font-size: 13px;
          letter-spacing: 0.2em;
          color: rgba(217,177,102,0.85);
        }
        .xfh-suits span.red { color: #b8544a; }

        .xfh-house {
          margin: 18px 0 0;
          text-align: center;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.42em;
          text-transform: uppercase;
          color: rgba(234,228,216,0.62);
        }

        .xfh-title {
          margin: 20px 0 0;
          text-align: center;
          font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
          font-weight: 400;
          font-size: clamp(38px, 7vw, 62px);
          line-height: 0.98;
          letter-spacing: 0.01em;
          color: #f4ecdd;
        }
        .xfh-title em {
          display: block;
          font-style: italic;
          font-size: 0.78em;
          letter-spacing: 0.02em;
          background: linear-gradient(180deg, var(--gold-bright) 0%, var(--gold) 62%, #9c7636 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .xfh-rule {
          margin: 24px auto 0;
          width: 168px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(217,177,102,0.55), transparent);
          position: relative;
        }
        .xfh-rule::after {
          content: '';
          position: absolute;
          top: -2.5px;
          left: 0;
          width: 34px;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(240,215,154,0.9), transparent);
          animation: xfh-shimmer 7s ease-in-out infinite;
        }
        @keyframes xfh-shimmer {
          0%, 100% { transform: translateX(0); opacity: 0.35; }
          50% { transform: translateX(134px); opacity: 1; }
        }

        .xfh-blurb {
          margin: 22px auto 0;
          max-width: 52ch;
          text-align: center;
          font-size: 14.5px;
          line-height: 1.72;
          color: rgba(234,228,216,0.72);
        }

        .xfh-plaque {
          margin: 30px auto 0;
          max-width: 480px;
          padding: 20px 20px 22px;
          border: 1px solid rgba(217,177,102,0.26);
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.18));
          box-shadow: inset 0 1px 0 rgba(240,215,154,0.08);
        }

        .xfh-plaque-label {
          display: block;
          text-align: center;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.34em;
          text-transform: uppercase;
          color: rgba(217,177,102,0.9);
        }

        .xfh-field {
          margin-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        @media (min-width: 540px) {
          .xfh-field { flex-direction: row; }
        }

        .xfh-input-wrap { position: relative; flex: 1 1 auto; }

        .xfh-input {
          width: 100%;
          padding: 14px 52px 14px 16px;
          font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
          font-size: 15px;
          letter-spacing: 0.18em;
          color: #f4ecdd;
          background: rgba(3,6,7,0.72);
          border: 1px solid rgba(217,177,102,0.22);
          border-radius: 2px;
          outline: none;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }
        .xfh-input::placeholder {
          letter-spacing: 0.02em;
          color: rgba(234,228,216,0.34);
        }
        .xfh-input:focus {
          border-color: rgba(217,177,102,0.75);
          box-shadow: 0 0 0 3px rgba(217,177,102,0.14);
        }
        .xfh-input[aria-invalid='true'] { border-color: rgba(184,84,74,0.8); }

        .xfh-eye {
          position: absolute;
          top: 50%;
          right: 6px;
          transform: translateY(-50%);
          padding: 8px;
          background: transparent;
          border: 0;
          border-radius: 2px;
          color: rgba(234,228,216,0.55);
          cursor: pointer;
          transition: color 140ms ease;
        }
        .xfh-eye:hover { color: var(--gold-bright); }
        .xfh-eye:focus-visible { outline: 2px solid rgba(217,177,102,0.8); outline-offset: 1px; }

        .xfh-enter {
          padding: 14px 26px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #14100a;
          border: 1px solid rgba(240,215,154,0.9);
          border-radius: 2px;
          background: linear-gradient(180deg, var(--gold-bright) 0%, var(--gold) 55%, #b8924c 100%);
          box-shadow: 0 6px 18px -8px rgba(217,177,102,0.7);
          cursor: pointer;
          transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
        }
        .xfh-enter:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px -8px rgba(240,215,154,0.65);
        }
        .xfh-enter:focus-visible { outline: 2px solid var(--gold-bright); outline-offset: 3px; }
        .xfh-enter:disabled { opacity: 0.38; cursor: default; }

        .xfh-error {
          margin: 12px 0 0;
          text-align: center;
          font-size: 13px;
          color: #d98a7e;
        }

        .xfh-foot {
          margin: 26px auto 0;
          max-width: 52ch;
          text-align: center;
          font-size: 12px;
          line-height: 1.7;
          color: rgba(234,228,216,0.42);
        }

        .xfh-mailto {
          color: rgba(217,177,102,0.92);
          text-decoration: none;
          border-bottom: 1px solid rgba(217,177,102,0.35);
          padding-bottom: 1px;
          transition: color 140ms ease, border-color 140ms ease;
        }
        .xfh-mailto:hover { color: var(--gold-bright); border-color: rgba(240,215,154,0.75); }

        .xfh-admin {
          margin: 18px 0 0;
          text-align: center;
        }
        .xfh-admin a {
          font-size: 11px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          text-decoration: none;
          color: rgba(217,177,102,0.72);
          border-bottom: 1px solid rgba(217,177,102,0.3);
          padding-bottom: 2px;
          transition: color 140ms ease, border-color 140ms ease;
        }
        .xfh-admin a:hover { color: var(--gold-bright); border-color: rgba(240,215,154,0.8); }

        @media (prefers-reduced-motion: reduce) {
          .xfh-rule::after { animation: none; }
          .xfh-enter:hover:not(:disabled) { transform: none; }
        }
      `}</style>

      <div className="xfh-hall" aria-hidden="true" />
      <div className="xfh-frame">
        <span className="xfh-corner tl" aria-hidden="true" />
        <span className="xfh-corner tr" aria-hidden="true" />
        <span className="xfh-corner bl" aria-hidden="true" />
        <span className="xfh-corner br" aria-hidden="true" />

        <div className="xfh-suits" aria-hidden="true">
          <span>&#9824;</span>
          <span className="red">&#9829;</span>
          <span className="red">&#9830;</span>
          <span>&#9827;</span>
        </div>

        <p className="xfh-house">XFH Game Studio &middot; Edmonton, Alberta</p>

        <h1 className="xfh-title">
          Open Flop
          <em>Texas Hold&rsquo;em</em>
        </h1>

        <div className="xfh-rule" aria-hidden="true" />

        <p className="xfh-blurb">
          A private table where the flop comes first. An ante opens the hand and becomes dead
          money once the flop is out; you then wager across three boards, each capped at that
          ante. The turn arrives, the river board opens, and every wager settles together.
        </p>

        <form onSubmit={submit} className="xfh-plaque">
          <label htmlFor="entry-code" className="xfh-plaque-label">
            Members&rsquo; entrance
          </label>

          <div className="xfh-field">
            <div className="xfh-input-wrap">
              <input
                id="entry-code"
                type={visible ? 'text' : 'password'}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Enter your code"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'entry-error' : undefined}
                className="xfh-input"
              />
              {/* Click to reveal: a mistyped character is visible without
                  retyping the whole code. */}
              <button
                type="button"
                onClick={() => setVisible((shown) => !shown)}
                aria-label={visible ? 'Hide code' : 'Show code'}
                aria-pressed={visible}
                title={visible ? 'Hide code' : 'Show code'}
                className="xfh-eye"
              >
                {visible ? (
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a19.8 19.8 0 0 1 5.06-6.06" />
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a19.8 19.8 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            <button type="submit" disabled={busy || !code.trim()} className="xfh-enter">
              {busy ? 'Checking' : 'Enter'}
            </button>
          </div>

          {error && (
            <p id="entry-error" role="alert" className="xfh-error">
              {error}
            </p>
          )}
        </form>

        <p className="xfh-foot">
          Access is by invitation. To request a code, write to{' '}
          <a className="xfh-mailto" href="mailto:info@xfhgamestudioltd.ca?subject=Access%20request%20-%20XFH%20Game%20Studio">
            info@xfhgamestudioltd.ca
          </a>
          . Each code carries its own expiry date.
        </p>

        <p className="xfh-admin">
          <a href="/access-admin">Issue or withdraw a pass</a>
        </p>
      </div>
    </div>
  );
}
