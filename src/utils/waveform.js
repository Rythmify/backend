// ============================================================
// utils/waveform.js — Waveform peak data generation / mock
// Returns a JSON array of normalised amplitude values (0–1)
// ============================================================
const generateMockWaveform = (samples = 200) =>
  Array.from({ length: samples }, () => parseFloat(Math.random().toFixed(3)));

module.exports = { generateMockWaveform };
