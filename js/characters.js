// js/characters.js — Free Fire Characters & Tournament Perks Engine

const CHARACTERS = {
  alok: {
    id: 'alok',
    name: 'DJ Alok',
    skillName: 'Drop the Beat',
    emoji: '🎧',
    shortBadge: '-15% Entry Fee',
    perkTitle: '15% Entry Fee Discount on All Paid Matches',
    perkDesc: 'Reduces entry fees by 15% across every paid solo & squad room (e.g. ₹40 becomes ₹34).',
    accent: 'text-orange-400',
    calculateFee: (baseFee) => {
      if (baseFee <= 0) return 0;
      return Math.max(1, Math.round(baseFee * 0.85));
    },
    calculatePerKill: (basePerKill) => basePerKill
  },

  hayato: {
    id: 'hayato',
    name: 'Hayato',
    skillName: 'Bushido Armor Penetration',
    emoji: '⚔️',
    shortBadge: '+₹5/Kill Bounty',
    perkTitle: '+₹5 Extra Cash on Every Confirmed Kill',
    perkDesc: 'Boosts your Per-Kill reward by +₹5 in all tournaments and Booyah OCR payouts!',
    accent: 'text-red-400',
    calculateFee: (baseFee) => baseFee,
    calculatePerKill: (basePerKill) => basePerKill + 5
  },

  chrono: {
    id: 'chrono',
    name: 'Chrono',
    skillName: 'Time Turner Shield',
    emoji: '🛡️',
    shortBadge: '100% Refund Shield',
    perkTitle: 'Instant 100% Entry Refund & Early Room Unlock',
    perkDesc: 'Allows you to cancel any joined room inside "My Rooms" for a 100% instant refund.',
    accent: 'text-cyan-400',
    calculateFee: (baseFee) => baseFee,
    calculatePerKill: (basePerKill) => basePerKill
  },

  kelly: {
    id: 'kelly',
    name: 'Kelly Swift',
    skillName: 'Deadly Velocity',
    emoji: '⚡',
    shortBadge: '20% Bonus Cash Use',
    perkTitle: 'Use 20% Booyah Bonus Cash + Zero-Fee UPI Withdraw',
    perkDesc: 'Lets you pay 20% of any entry fee using Booyah Bonus Cash + priority ₹0 fee UPI payouts.',
    accent: 'text-amber-400',
    calculateFee: (baseFee, bonusBalance = 0) => {
      if (baseFee <= 0) return 0;
      const bonusDeduction = Math.min(bonusBalance, Math.round(baseFee * 0.20));
      return Math.max(1, baseFee - bonusDeduction);
    },
    calculatePerKill: (basePerKill) => basePerKill
  },

  wukong: {
    id: 'wukong',
    name: 'Wukong',
    skillName: 'Camouflage Stealth',
    emoji: '🐒',
    shortBadge: 'Stealth Lobby UID',
    perkTitle: 'Anonymous Slot Masking + ₹5 Flat Entry Rebate',
    perkDesc: 'Hides your IGN & K/D in the 48-Slot lobby so rival squads cannot stream-snipe you + ₹5 off.',
    accent: 'text-emerald-400',
    calculateFee: (baseFee) => {
      if (baseFee <= 0) return 0;
      return Math.max(1, baseFee - 5);
    },
    calculatePerKill: (basePerKill) => basePerKill
  }
};

// Helper: Calculate Effective Match Figures based on Active Character Perk
function getEffectiveMatchNumbers(match, equippedCharId = 'alok', bonusBalance = 0) {
  const char = CHARACTERS[equippedCharId] || CHARACTERS.alok;
  let finalFee = match.entry_fee || match.entryFee || 0;
  let discountNote = '';
  let effectivePerKill = match.per_kill || match.perKill || 0;
  let killBoosted = false;

  const baseFee = finalFee;
  const basePerKill = effectivePerKill;

  if (baseFee > 0) {
    if (char.id === 'alok') {
      finalFee = char.calculateFee(baseFee);
      discountNote = 'DJ Alok -15% Off';
    } else if (char.id === 'kelly') {
      const bonusCut = Math.min(bonusBalance, Math.round(baseFee * 0.20));
      if (bonusCut > 0) {
        finalFee = char.calculateFee(baseFee, bonusBalance);
        discountNote = `Kelly -₹${bonusCut} Bonus Used`;
      }
    } else if (char.id === 'wukong') {
      finalFee = char.calculateFee(baseFee);
      discountNote = 'Wukong -₹5 Stealth Rebate';
    }
  }

  if (char.id === 'hayato') {
    effectivePerKill = char.calculatePerKill(basePerKill);
    killBoosted = true;
  }

  return {
    baseFee,
    finalFee,
    discountAmount: Math.max(0, baseFee - finalFee),
    discountNote,
    basePerKill,
    effectivePerKill,
    killBoosted
  };
}