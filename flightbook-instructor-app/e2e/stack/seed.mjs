// Creates an instructor, a school (instructor = admin team member) and its
// students directly in Postgres, and mints a legacy JWT for the instructor
// (the API's CompositeAuthGuard falls back to JWT_SECRET-signed tokens when
// Keycloak rejects them). Appointments are created per test by the specs.
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PG_CONTAINER, SEED } from '../tests/seed-data.js';

const AUTH_DIR = fileURLToPath(new URL('../.auth/', import.meta.url));
const SECRET = 'local-e2e-secret'; // must match JWT_SECRET in api.env

const psql = (sql) =>
  execFileSync('docker', ['exec', PG_CONTAINER, 'psql', '-U', 'fb', '-d', 'flightbook_test', '-tAqc', sql], { encoding: 'utf8' }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (payload) => {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
};

const newUser = (u) =>
  psql(`insert into data.app_user (email, firstname, lastname, enabled, created_at, validated_at, payment_exempted, last_login)
        values (${q(u.email)}, ${q(u.firstname)}, ${q(u.lastname)}, true, now() - interval '1 day', now(), true, now())
        returning id`);

const instructorId = newUser(SEED.instructor);
const schoolConfig = { schoolModule: { active: true, validateFlights: false, userCanEditControlSheet: true } };
const schoolId = psql(`
  insert into data.school (name, address1, plz, city, phone, email, language, config)
  values (${q(SEED.school.name)}, 'Seestrasse 1', '6376', 'Emmetten', '+41410000000', 'school@local.test', 'de', ${q(JSON.stringify(schoolConfig))})
  returning id`);
psql(`insert into data.team_member (admin, user_id, school_id) values (true, ${instructorId}, ${schoolId})`);
for (const s of SEED.students) {
  const userId = newUser(s);
  psql(`insert into data.student (user_id, school_id) values (${userId}, ${schoolId})`);
}

const now = Math.floor(Date.now() / 1000);
const token = sign({ sub: Number(instructorId), email: SEED.instructor.email, iat: now, exp: now + 30 * 24 * 3600 });
fs.mkdirSync(AUTH_DIR, { recursive: true });
fs.writeFileSync(AUTH_DIR + 'token.txt', token);
fs.writeFileSync(AUTH_DIR + 'school.txt', schoolId);

console.log(`seeded instructor #${instructorId}, school #${schoolId}, ${SEED.students.length} students`);
