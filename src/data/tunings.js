export const TUNINGS = {
  guitar: {
    name: "Standard (EADGBE)",
    stringCount: 6,
    // Index 0 = string 6 (thickest, lowest pitch, low E)
    // Index 5 = string 1 (thinnest, highest pitch, high e)
    notes: ["E2", "A2", "D3", "G3", "B3", "E4"],
    stringNames: ["E", "A", "D", "G", "B", "e"],
  },
  bass: {
    name: "Standard (EADG)",
    stringCount: 4,
    // Index 0 = string 4 (thickest, low E)
    // Index 3 = string 1 (thinnest, G)
    notes: ["E1", "A1", "D2", "G2"],
    stringNames: ["E", "A", "D", "G"],
  },
  ukulele: {
    name: "Standard (GCEA)",
    stringCount: 4,
    // Re-entrant tuning: string 4 (G4) is higher pitch than strings 3 & 2
    // Index 0 = string 4 (G), Index 3 = string 1 (A)
    notes: ["G4", "C4", "E4", "A4"],
    stringNames: ["G", "C", "E", "A"],
  },
};
