import React, { useState, useEffect } from 'react';

const STEPS = [
  {
    step: 1,
    title: 'Place Your Ante',
    icon: '🃏',
    description: 'The board is open for play. Consider the Max wager amount you want to place per board — this will be the player\'s Ante. Once your Ante value is chosen by clicking the chip denomination values, press the Deal Button.',
    highlight: 'The Ante is your privilege to see the flop and is not returned.',
  },
  {
    step: 2,
    title: 'Bet the Flop',
    icon: '🔓',
    description: 'The flop is made and 3 cards appear. All open positions on the 3 boards are now available to wager. Choose and place your wagers. Once you are comfortable with your selections, tap the Deal Turn button. Each board indicates with a Match Ante count.',
    highlight: 'Wager from zero up to each board\'s cap, or fold. Card and Rank cap at the Ante. The Color board caps at the Ante — plus your Card and Rank bets when Cascade Betting is ON.',
  },
  {
    step: 3,
    title: 'Bet the River',
    icon: '🌊',
    description: 'The turn card is shown, and the river board opens. Based on the available cards displayed in the dealer\'s area, player can choose to bet if the next card is Low (2-7) or High (8-Ace), or no bet. Player can bet zero or up to the Max Value of the total sum from all 3 betting boards. Ante is not included in the sum value. Once bet is made, player taps the deal button.',
    highlight: 'The River bet max equals the combined total of all 3 board bets. The Ante does not count toward this sum.',
  },
  {
    step: 4,
    title: 'Results',
    icon: '💰',
    description: 'The river card is turned over and the results are indicated. A display window will appear showing your winning or losing results.',
    highlight: 'Tap the New Hand button to return to the beginning of the game.',
  },
];

export default function HowToPlayModal({ isOpen, onClose }) {
  const [step, setStep] = useState(0);

  // Reset to step 1 every time the modal opens
  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const current = STEPS[step];

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      // NO onClick on backdrop — only SKIP ✕ and Let's Play! close the modal
    >
      <div style={{
        background: 'linear-gradient(160deg, rgba(20,10,0,0.98) 0%, rgba(40,20,0,0.98) 100%)',
        border: '1.5px solid rgba(234,179,8,0.5)',
        borderRadius: 18,
        padding: '28px 32px 32px',
        maxWidth: 480,
        width: '90%',
        boxShadow: '0 8px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(234,179,8,0.1)',
        position: 'relative',
      }}>

        {/* SKIP button — only way to exit other than Let's Play */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute', top: 14, right: 16,
            background: 'transparent', border: 'none',
            color: 'rgba(253,224,71,0.4)', fontSize: 12,
            cursor: 'pointer', fontWeight: 700, letterSpacing: '0.06em',
          }}
        >
          SKIP ✕
        </button>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, justifyContent: 'center' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 24 : 8, height: 8, borderRadius: 4,
              background: i === step ? '#eab308' : i < step ? 'rgba(234,179,8,0.4)' : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        {/* Icon */}
        <div style={{ textAlign: 'center', fontSize: 48, marginBottom: 12, lineHeight: 1 }}>
          {current.icon}
        </div>

        {/* Step label */}
        <div style={{
          textAlign: 'center', fontSize: 10, fontWeight: 800,
          color: 'rgba(234,179,8,0.6)', letterSpacing: '0.12em',
          textTransform: 'uppercase', marginBottom: 6,
        }}>
          STEP {current.step} OF {STEPS.length}
        </div>

        {/* Title */}
        <div style={{
          textAlign: 'center', fontSize: 22, fontWeight: 800,
          color: '#ffffff', marginBottom: 14, lineHeight: 1.2,
        }}>
          {current.title}
        </div>

        {/* Description */}
        <div style={{
          fontSize: 14, color: '#cbd5e1', lineHeight: 1.65,
          textAlign: 'center', marginBottom: 16,
        }}>
          {current.description}
        </div>

        {/* Highlight bar */}
        <div style={{
          background: 'rgba(234,179,8,0.08)',
          border: '1px solid rgba(234,179,8,0.25)',
          borderRadius: 8, padding: '10px 14px',
          fontSize: 12, color: '#fde047', fontWeight: 700,
          textAlign: 'center', marginBottom: 28,
          lineHeight: 1.5,
        }}>
          {current.highlight}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {step > 0 && (
            <button
              onClick={handleBack}
              style={{
                padding: '10px 22px', borderRadius: 9,
                border: '1px solid rgba(234,179,8,0.35)',
                background: 'transparent',
                color: '#fde047', fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
          )}
          <button
            onClick={handleNext}
            style={{
              padding: '10px 28px', borderRadius: 9,
              border: 'none',
              background: 'linear-gradient(135deg, #b45309, #eab308)',
              color: '#000', fontSize: 13, fontWeight: 800,
              cursor: 'pointer', flex: step === 0 ? 1 : 'none',
              letterSpacing: '0.04em',
            }}
          >
            {step < STEPS.length - 1 ? 'Next →' : "Let's Play!"}
          </button>
        </div>
      </div>
    </div>
  );
}