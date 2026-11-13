// ============================================================
// OPEN FLOP EXCEL EXPORTER
// Generates an .xlsx file with:
//   - Header section with adjustable RTP cell
//   - 4,960 rows, one per flop combination
//   - Probability + Payout columns for each Card hand (10) and Rank position (7)
//   - Payout columns use Excel formulas referencing the RTP cell
//     so changing RTP recalculates every payout automatically
//
// Formula: payout = (RTP/100) / probability - 1
//   At RTP=100: true odds (1:1, no house edge)
//   At RTP=96: 4% house edge applied
// ============================================================

import ExcelJS from 'exceljs';
import probabilityMatrix from './openFlopProbabilityMatrix.json';

// Column letter helper (0-indexed → Excel letter)
function colLetter(idx) {
  let s = '';
  while (idx >= 0) {
    s = String.fromCharCode(65 + (idx % 26)) + s;
    idx = Math.floor(idx / 26) - 1;
  }
  return s;
}

const HAND_LABELS = [
  'Hand 1 (A♦10♥)', 'Hand 2 (K♣K♠)', 'Hand 3 (Q♣J♠)', 'Hand 4 (Q♠10♠)',
  'Hand 5 (J♣9♣)', 'Hand 6 (8♦6♦)', 'Hand 7 (7♦7♠)', 'Hand 8 (4♥2♥)',
  'Hand 9 (3♣3♥)', 'Hand 10 (A♥5♦)'
];

const RANK_NAMES = ['1 Pair', '2 Pair', '3 Of A Kind', 'Straight', 'Flush', 'Full House', '4 Of A Kind'];

export async function generateOpenFlopExcel(rtpValue = 100) {
  // Build the worksheet as an array of arrays + formula overrides
  // Layout:
  // Row 0: Title
  // Row 1: RTP label + value cell (B2 in 1-indexed = row 1, col 1)
  // Row 2: House Edge label + formula
  // Row 3: blank
  // Row 4: Total Flops label + value
  // Row 5: blank
  // Row 6: Column headers (two-row header: group + sub)
  // Row 7+: Data

  const rtpCellRef = '$B$2'; // 1-indexed: B2 = row 2, col B

  // ── Build header rows ──────────────────────────────────────
  const wsData = [];

  // Row 0: Title
  wsData.push(['Open Flop Probability Matrix — Rapid Fire Texas Hold\'em']);
  // Row 1: RTP setting
  wsData.push(['RTP %', rtpValue, '(Change this cell to recalculate all payouts)']);
  // Row 2: House Edge (formula)
  wsData.push(['House Edge', { formula: `1-${rtpCellRef}/100` }, '(auto-calculated)']);
  // Row 3: blank
  wsData.push([]);
  // Row 4: Total flops
  wsData.push(['Total Flops', probabilityMatrix.length, 'Flop combinations from 32-card stock (C(32,3) = 4,960)']);
  // Row 5: blank
  wsData.push([]);

  // Row 6-7: Two-row header
  // Group headers
  const groupHeader = ['Flop #', 'Card 1', 'Card 2', 'Card 3', 'Board Win %'];
  for (let h = 0; h < 10; h++) groupHeader.push(HAND_LABELS[h], '', '');
  for (let r = 0; r < 7; r++) groupHeader.push(RANK_NAMES[r], '', '');
  wsData.push(groupHeader);

  // Sub headers
  const subHeader = ['', '', '', '', ''];
  for (let h = 0; h < 10; h++) subHeader.push('Prob %', 'True Odds', 'Payout');
  for (let r = 0; r < 7; r++) subHeader.push('Prob %', 'True Odds', 'Payout');
  wsData.push(subHeader);

  // ── Data rows (row 8+ = 0-indexed row 8) ───────────────────
  // Column indices (0-indexed):
  // 0: Flop #
  // 1: Card 1
  // 2: Card 2
  // 3: Card 3
  // 4: Board Win %
  // 5-34: 10 Card hands × 3 cols (Prob, TrueOdds, Payout) = cols 5-34
  // 35-55: 7 Ranks × 3 cols (Prob, TrueOdds, Payout) = cols 35-55

  for (let i = 0; i < probabilityMatrix.length; i++) {
    const entry = probabilityMatrix[i];
    const row = [];
    const excelRowNum = i + 9; // 1-indexed Excel row (data starts at row 9)

    row.push(entry.flopId);
    row.push(entry.cards[0]);
    row.push(entry.cards[1]);
    row.push(entry.cards[2]);
    row.push(entry.boardWinProb);

    // Card hand probabilities and payouts
    for (let h = 0; h < 10; h++) {
      const cp = entry.cardProbabilities[h];
      const probCol = colLetter(5 + h * 3);      // Prob column letter
      const trueOddsCol = colLetter(5 + h * 3 + 1); // True Odds column
      const payoutCol = colLetter(5 + h * 3 + 2);  // Payout column

      if (cp.probability === 0) {
        row.push(0, 'DEAD', 'DEAD');
      } else {
        const probCellRef = `${probCol}${excelRowNum}`;
        // True Odds = 1/p - 1 (static)
        row.push(cp.probability, { formula: `1/${probCellRef}-1` });
        // Payout at RTP = (RTP/100) / p - 1 (formula referencing RTP cell)
        row.push({ formula: `(${rtpCellRef}/100)/${probCellRef}-1` });
      }
    }

    // Rank probabilities and payouts
    for (let r = 0; r < 7; r++) {
      const rp = entry.rankProbabilities[r];
      const probCol = colLetter(35 + r * 3);
      const trueOddsCol = colLetter(35 + r * 3 + 1);
      const payoutCol = colLetter(35 + r * 3 + 2);

      if (rp.probability === 0) {
        row.push(0, 'DEAD', 'DEAD');
      } else {
        const probCellRef = `${probCol}${excelRowNum}`;
        row.push(rp.probability, { formula: `1/${probCellRef}-1` });
        row.push({ formula: `(${rtpCellRef}/100)/${probCellRef}-1` });
      }
    }

    wsData.push(row);
  }

  // Create workbook + worksheet
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Open Flop Matrix');

  // Data rows (formula objects are written as live Excel formulas)
  for (const row of wsData) {
    ws.addRow(row);
  }

  // Set column widths
  const widths = [8, 8, 8, 8, 12];         // Flop #, Card 1-3, Board Win %
  for (let i = 0; i < 17; i++) widths.push(10, 12, 12); // Prob, TrueOdds, Payout
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Merge title row across all columns (1-indexed: row, left col, row, right col)
  ws.mergeCells(1, 1, 1, 11);   // Title
  ws.mergeCells(2, 3, 2, 11);   // RTP note
  ws.mergeCells(3, 3, 3, 11);   // House edge note
  ws.mergeCells(5, 3, 5, 11);   // Total flops note

  // Merge group header cells (each group spans 3 columns)
  for (let h = 0; h < 10; h++) {
    ws.mergeCells(7, 5 + h * 3 + 1, 7, 5 + h * 3 + 3);
  }
  for (let r = 0; r < 7; r++) {
    ws.mergeCells(7, 35 + r * 3 + 1, 7, 35 + r * 3 + 3);
  }

  // Generate file
  const wbout = await wb.xlsx.writeBuffer();
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function downloadOpenFlopExcel(rtpValue = 100) {
  const blob = await generateOpenFlopExcel(rtpValue);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Open-Flop-Probability-Matrix-RTP-${rtpValue}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Matrix summary getter ─────────────────────────────────────
export function getMatrixSummary() {
  let deadCards = 0, deadRanks = 0;
  let totalCardProb = 0, totalRankProb = 0;
  let maxCardProb = 0, maxRankProb = 0;
  const cardProbRange = { min: 1, max: 0 };
  const rankProbRange = { min: 1, max: 0 };

  for (const e of probabilityMatrix) {
    for (const cp of e.cardProbabilities) {
      if (cp.probability === 0) deadCards++;
      totalCardProb += cp.probability;
      if (cp.probability > 0) {
        cardProbRange.min = Math.min(cardProbRange.min, cp.probability);
        cardProbRange.max = Math.max(cardProbRange.max, cp.probability);
      }
    }
    for (const rp of e.rankProbabilities) {
      if (rp.probability === 0) deadRanks++;
      totalRankProb += rp.probability;
      if (rp.probability > 0) {
        rankProbRange.min = Math.min(rankProbRange.min, rp.probability);
        rankProbRange.max = Math.max(rankProbRange.max, rp.probability);
      }
    }
  }

  return {
    totalFlops: probabilityMatrix.length,
    totalCardPositions: probabilityMatrix.length * 10,
    totalRankPositions: probabilityMatrix.length * 7,
    deadCardPositions: deadCards,
    deadRankPositions: deadRanks,
    liveCardPositions: probabilityMatrix.length * 10 - deadCards,
    liveRankPositions: probabilityMatrix.length * 7 - deadRanks,
    cardProbRange,
    rankProbRange,
    avgCardProbSum: totalCardProb / probabilityMatrix.length,
    avgRankProbSum: totalRankProb / probabilityMatrix.length,
  };
}

export { probabilityMatrix };