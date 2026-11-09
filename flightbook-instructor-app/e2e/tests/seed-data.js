// Shared between stack/seed.mjs (which creates this data) and the specs
// (which assert against it).
export const API_URL = 'http://localhost:8282';
export const PG_CONTAINER = 'fb-e2e-instructor-pg';

export const SEED = {
  // The token holder: admin team member of the school.
  instructor: { email: 'instructor@local.test', firstname: 'Ivo', lastname: 'Instructor' },
  school: { name: 'Test Flight School' },
  // 17 students, as in the reported case (17 registered, max 12, 5 waiting).
  students: Array.from({ length: 17 }, (_, i) => ({
    email: `student${String(i + 1).padStart(2, '0')}@local.test`,
    firstname: `Student${String(i + 1).padStart(2, '0')}`,
    lastname: 'Pilot',
  })),
};
