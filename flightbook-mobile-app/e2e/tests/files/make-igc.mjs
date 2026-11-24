// Generates tests/files/flight.igc: a small synthetic paragliding track for the
// IGC import test. 1 min on the ground, 15 min straight flight NE at ~8 m/s,
// 1 min on the ground again — enough for igc-xc-score to find launch, landing
// and a distance. Re-run with `node tests/files/make-igc.mjs` if it ever changes.
import fs from 'node:fs';

const lines = [
  'AXXXE2E',
  'HFDTEDATE:150826,01',
  'HFPLTPILOTINCHARGE:Test Pilot',
  'HFSITSITE:E2E IGC Launch',
];
const pad = (n, w) => String(Math.round(n)).padStart(w, '0');
const coord = (deg, w, pos, neg) => {
  const d = Math.floor(Math.abs(deg));
  const m = (Math.abs(deg) - d) * 60;
  return pad(d, w) + pad(m * 1000, 5) + (deg >= 0 ? pos : neg);
};
let lat = 46.94, lon = 8.556, alt = 1570;
const t0 = 10 * 3600; // 10:00:00 UTC
// One fix a minute: the xc-score solver's time grows steeply with the fix count
// (~200 ms here; 5 s at a fix every 2 s, the length of an assertion timeout).
const STEP = 60;
for (let s = 0; s <= 17 * 60; s += STEP) {
  const flying = s > 60 && s < 16 * 60;
  if (flying) {
    lat += (8 * STEP * 0.7) / 111_320;
    lon += (8 * STEP * 0.7) / (111_320 * Math.cos((lat * Math.PI) / 180));
    alt = Math.max(500, alt - 1.2 * STEP);
  }
  const t = t0 + s;
  const hhmmss = pad(t / 3600 - 0.4999, 2) + pad((t % 3600) / 60 - 0.4999, 2) + pad(t % 60, 2);
  lines.push(`B${hhmmss}${coord(lat, 2, 'N', 'S')}${coord(lon, 3, 'E', 'W')}A${pad(alt, 5)}${pad(alt, 5)}`);
}
fs.writeFileSync(new URL('./flight.igc', import.meta.url), lines.join('\r\n') + '\r\n');
