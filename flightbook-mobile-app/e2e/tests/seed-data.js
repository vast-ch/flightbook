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
  // The seeded user is a student *and* a tandem pilot of this school, which
  // unlocks the school, control-sheet and passenger-confirmation screens.
  school: {
    name: 'Test Flight School',
    instructor: { email: 'instructor@local.test', firstname: 'Ivo', lastname: 'Instructor' },
    appointmentType: 'Höhenflug',
    // Days from "today" (the database's, not the app's fixed clock) at 08:00 UTC.
    appointmentsInDays: [2, 5, 9],
    passengers: [
      { firstname: 'Anna', lastname: 'Passenger', place: 'Emmetten' },
      { firstname: 'Ben', lastname: 'Passenger', place: 'Niederbauen' },
    ],
    emergencyContact: { firstname: 'Eva', lastname: 'Contact', phone: '+41790000000' },
  },
};
