// Shared between stack/seed.mjs (which creates this data) and the specs
// (which assert against it).
export const API_URL = 'http://localhost:8282';

export const SEED = {
  user: { email: 'pilot@local.test', firstname: 'Test', lastname: 'Pilot' },
  places: [
    { name: 'Niederbauen', altitude: 1570, country: 'ch', lngLat: [8.556, 46.94] },
    { name: 'Emmetten', altitude: 770, country: 'ch', lngLat: [8.515, 46.957] },
    { name: 'Fiesch Kühboden', altitude: 2212, country: 'ch', lngLat: [8.111, 46.408] },
  ],
  gliders: [
    { brand: 'Advance', name: 'Iota DLS', buyDate: '2023-04-01', tandem: false, archived: false, note: 'Main wing' },
    { brand: 'Niviuk', name: 'Hook 6', buyDate: '2021-03-15', tandem: false, archived: false },
  ],
  flightCount: 12,
};
