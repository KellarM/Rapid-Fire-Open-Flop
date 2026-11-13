// GameRulesModal — standalone full-screen rules modal for Open Flop.
// Matches the Desktop Gameking GameRulesModal look and style exactly:
// dark blurred backdrop, centered wide card, header with icon/title/subtitle/X,
// badge strip with live config values, scrollable collapsible sections.
// Triggered from SettingsModal "Game Rules" tab (same pattern as How to Play).

import { useState, useEffect } from 'react';
import { X, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getSavedStructureId,
  getStructureById,
  getAnteTierDescriptions,
} from '../../lib/game/anteStructures';
import { getSavedBonusMultipliers } from '../../lib/game/bonusMultipliers';
import { getSavedCascadeEnabled } from '../../lib/game/cascadeBetting';

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-slate-800/80 hover:bg-slate-700/60 transition-colors"
      >
        <span className="font-bold text-yellow-400 text-sm tracking-wide uppercase">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 py-4 bg-slate-900/40 text-sm text-gray-300 space-y-2">{children}</div>}
    </div>
  );
}

function Rule({ label, children }) {
  return (
    <div className="flex gap-2">
      <span className="text-yellow-500 mt-0.5 flex-shrink-0">•</span>
      <div>
        <span className="text-white font-semibold">{label}</span>
        {children && <span className="text-gray-300"> — {children}</span>}
      </div>
    </div>
  );
}

function Badge({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 text-xs font-bold">
      {label}: <span className="text-white">{value}</span>
    </span>
  );
}

export default function GameRulesModal({ isOpen, onClose }) {
  // Re-read live config values every time the modal opens so the rules
  // always reflect whatever the operator tools are currently set to.
  const [structure, setStructure] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [bonusMults, setBonusMults] = useState({ card: 5, rank: 4, colorRiver: 3 });
  const [cascade, setCascade] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const sid = getSavedStructureId();
      const s = getStructureById(sid);
      setStructure(s);
      setTiers(getAnteTierDescriptions(s, 4));
    } catch {}
    try { setBonusMults(getSavedBonusMultipliers()); } catch {}
    try { setCascade(getSavedCascadeEnabled()); } catch {}
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-yellow-700/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-yellow-700/30 bg-gradient-to-r from-yellow-900/30 to-orange-900/20 flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-yellow-400" />
                  <h2 className="text-xl font-black text-yellow-400" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    RAPID FIRE OPEN FLOP — GAME RULES
                  </h2>
                </div>
                <p className="text-gray-400 text-xs mt-0.5">Everything you need to know to play</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live config badge strip */}
            <div className="flex flex-wrap gap-2 px-6 py-2.5 border-b border-yellow-700/20 bg-black/30">
              <Badge label="Ante Structure" value={structure ? structure.name : '—'} />
              <Badge label="Card Bonus" value={`${bonusMults.card}×`} />
              <Badge label="Rank Bonus" value={`${bonusMults.rank}×`} />
              <Badge label="Color/River Bonus" value={`${bonusMults.colorRiver}×`} />
              <Badge label="Cascade Betting" value={cascade ? 'ON' : 'OFF'} />
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

              <Section title="How the Game Works" defaultOpen={true}>
                <Rule label="Objective">Bet on the outcome of a poker round across four boards — Card, Rank, Color, and River — through two separate stages as community cards are revealed. All bets are optional at every stage.</Rule>
                <Rule label="Round Flow">Place your Ante to start the round and reveal the Flop. Then bet on the Card, Rank, and Color boards as they open, reveal the Turn, bet the River, and reveal the final card to resolve everything.</Rule>
                <Rule label="10 Fixed Hands">Ten two-card hands are dealt face-up before each round. The best 5-card poker hand formed from each hand's 2 cards plus the 5 community cards determines the winner.</Rule>
                <Rule label="32-Card Stock">After the 10 hands are removed, 32 community cards remain. Five are dealt as community cards: Flop (3), Turn (1), and River (1).</Rule>
                <Rule label="Dynamic Odds">All odds are calculated from the remaining cards in the deck after the Flop. They update in real time as each card is revealed.</Rule>
                <Rule label="Locked Positions">As the board develops, some betting positions may lock and become unavailable. This happens when a position becomes impossible to hit, becomes heavily favored beyond a set threshold, or its resulting payout would fall outside the game's posted odds range. Locked positions cannot be bet on for that round.</Rule>
              </Section>

              <Section title="The Ante">
                <Rule label="Ante">Select a chip denomination and place your Ante, then press Deal. Your Ante is your entry into the round — it is not a bet on any board and it does not count toward the River cap{cascade ? ', though Cascade Betting does add it to the Color board cap' : ''}, and it gives you a real shot at winning it back plus a bonus, based on how many boards you qualify on. See Ante Return below for the exact payout tiers.</Rule>
                <Rule label="All Bets Optional">All subsequent bets are optional. You may place bets on any or all boards, or fold at any stage.</Rule>
              </Section>

              <Section title="After the Flop">
                <p className="text-gray-400 text-xs mb-3">Once the Flop is dealt, the Card, Rank, and Color boards open for betting. All bets are optional — you may bet on one, some, or all three boards, or none at all.</p>
                <Rule label="Per-Board Cap">
                  {cascade
                    ? "Card and Rank are each capped at your Ante. Cascade Betting is ON, so the Color board is capped at your Ante plus the combined total of your Card and Rank bets — its Match Ante figure climbs as those boards fill."
                    : "Every board is capped at your Ante. Cascade Betting is OFF, so the Color board cannot go above the Ante, no matter what the other boards hold."}
                  {' '}You may spread a board's wager across multiple positions, but the combined total on that board cannot exceed that board's cap.
                </Rule>
                <Rule label="Qualifying for Ante Return">To have a board count toward your Ante return, the full Ante amount must be placed on a single winning position on that board. Splitting the Ante across multiple positions — even if the total equals the Ante — will not qualify that board.</Rule>
                <Rule label="Card Board">Bet on which of the 10 fixed hands will win the round. Each hand has its own odds based on the Flop.</Rule>
                <Rule label="Rank Board">Bet on the poker rank of the winning hand (One Pair through Four of a Kind). Odds depend on the current board state.</Rule>
                <Rule label="Color Board">Bet on the exact number of Red or Black cards in the 5 community cards. Only one color side is live per round based on the Flop's composition.</Rule>
                <p className="text-gray-400 text-xs mt-2">When you are satisfied with your bets, press Deal to reveal the Turn card.</p>
              </Section>

              <Section title="After the Turn — The River">
                <p className="text-gray-400 text-xs mb-3">Once the Turn is dealt, the River board opens for betting. Betting the River is optional.</p>
                <Rule label="Unlocking the River">The total sum of the Ante must be placed across the three post-flop boards (Card, Rank, and Color combined) for the River board to open. If you have not placed bets totalling at least the Ante across those boards, the River board remains closed.</Rule>
                <Rule label="River Cap">Once open, you may wager up to the combined total of your Card, Rank, and Color bets. The Ante does not count toward this cap.</Rule>
                <Rule label="Qualifying for Ante Return">The same qualifying rule applies: the full Ante must be placed on a single winning River position for the River board to count toward your Ante return.</Rule>
                <Rule label="Low / High">Bet whether the River card will be Low (2 through 7) or High (8 through Ace). Odds are calculated from the remaining unseen cards.</Rule>
                <p className="text-gray-400 text-xs mt-2">Press Deal to reveal the River card and resolve all boards.</p>
              </Section>

              <Section title="Resolution">
                <p className="text-gray-400 text-xs mb-3">All four boards resolve simultaneously when the River card is revealed.</p>
                <Rule label="Card Board">Pays if the hand you backed forms the highest 5-card poker hand. Payout is based on that hand's posted odds.</Rule>
                <Rule label="Rank Board">Pays if the winning hand achieves the rank you bet. Payout uses the odds posted for the actual winning hand.</Rule>
                <Rule label="Color Board">Pays based on the exact count of Red or Black cards across all 5 community cards. The count must match your bet exactly.</Rule>
                <Rule label="River Board">Pays based on whether the River card is Low (2–7) or High (8–A) and your selected side's posted odds.</Rule>
                <Rule label="Board Win">If the community board beats all 10 player hands, all Card and Rank bets lose. Color and River bets still resolve independently.</Rule>
              </Section>

              <Section title="Bonus Round" defaultOpen={false}>
                <p className="text-gray-400 text-xs mb-3">During resolution, the game randomly highlights one Card Hand position, one Rank position, and one Color or River position.</p>
                <Rule label="Bonus Payout">If your winning bet lands on a highlighted position, that bet pays out at {bonusMults.card}× for Card Hands, {bonusMults.rank}× for Rank Hands, and {bonusMults.colorRiver}× for Color &amp; River — instead of its normal odds.</Rule>
                <Rule label="Losing Bets">A bet that loses does not receive a bonus payout, even if its position is highlighted.</Rule>
              </Section>

              <Section title="Ante Return" defaultOpen={false}>
                <p className="text-gray-400 text-xs mb-3">The Ante is returned based on how many of the four boards (Card, Rank, Color, River) you qualify on — meaning the full Ante was placed on a single winning position.</p>
                <div className="space-y-1.5">
                  {tiers.map((tier, i) => (
                    <div key={i} className={`flex justify-between items-center rounded-lg px-3 py-1.5 border
                      ${tier.kind === 'loss'
                        ? 'border-red-700/30 bg-red-900/10'
                        : tier.kind === 'bonus'
                          ? 'border-yellow-700/40 bg-yellow-900/10'
                          : 'border-slate-600/30 bg-slate-800/40'
                      }`}>
                      <span className={`text-white font-bold text-xs
                        ${tier.kind === 'loss' ? 'text-red-300' : tier.kind === 'bonus' ? 'text-yellow-300' : 'text-gray-300'}`}>
                        {tier.range} {tier.boardWord}
                      </span>
                      <span className={`text-xs font-bold
                        ${tier.kind === 'loss' ? 'text-red-400' : tier.kind === 'bonus' ? 'text-green-400' : 'text-gray-400'}`}>
                        {tier.outcome}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Odds &amp; RTP" defaultOpen={false}>
                <p className="text-gray-400 text-xs italic">Odds and RTP information will be added in a future update.</p>
              </Section>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}