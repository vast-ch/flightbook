// Creates the test user directly in Postgres, mints a legacy JWT for it (the
// API's CompositeAuthGuard falls back to JWT_SECRET-signed tokens when
// Keycloak rejects them) and seeds the rest through the API itself, so the
// data goes through the same mapping as real user input.
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { API_URL, SEED } from '../tests/seed-data.js';

const AUTH_DIR = fileURLToPath(new URL('../.auth/', import.meta.url));
const SECRET = 'local-e2e-secret'; // must match JWT_SECRET in api.env

const psql = (sql) =>
  execFileSync('docker', ['exec', 'fb-e2e-pg', 'psql', '-U', 'fb', '-d', 'flightbook_test', '-tAqc', sql], { encoding: 'utf8' }).trim();

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (payload) => {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
};

const { user } = SEED;
const userId = psql(
  `insert into data.app_user (email, firstname, lastname, enabled, created_at, validated_at, payment_exempted, last_login)
   values ('${user.email}', '${user.firstname}', '${user.lastname}', true, now() - interval '1 day', now(), true, now())
   returning id`,
);
// School data has no student-facing create endpoints (instructors create it
// through the instructor app), so it goes in as SQL.
const { school } = SEED;
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const schoolConfig = {
  schoolModule: { active: true, validateFlights: true, userCanEditControlSheet: true },
  tandemModule: { active: true },
};
// A 1×1 transparent PNG stands in for the passenger's signature. The app
// stores (and renders as <img src>) the signature pad's full data URL.
const signature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const schoolId = psql(`
  with instructor as (
    insert into data.app_user (email, firstname, lastname, enabled, created_at, validated_at, payment_exempted)
    values (${q(school.instructor.email)}, ${q(school.instructor.firstname)}, ${q(school.instructor.lastname)}, true, now(), now(), true)
    returning id
  ), s as (
    insert into data.school (name, address1, plz, city, phone, email, language, config)
    values (${q(school.name)}, 'Seestrasse 1', '6376', 'Emmetten', '+41410000000', 'school@local.test', 'de', ${q(JSON.stringify(schoolConfig))})
    returning id
  ), tm as (
    insert into data.team_member (admin, user_id, school_id) select true, instructor.id, s.id from instructor, s
  ), st as (
    insert into data.student (user_id, school_id) select ${userId}, s.id from s
  ), tp as (
    insert into data.tandem_pilot (user_id, school_id) select ${userId}, s.id from s
  )
  select id from s`);
psql(`
  with t as (
    insert into data.appointment_type (name, school_id, meeting_point, max_people, color, time)
    values (${q(school.appointmentType)}, ${schoolId}, 'Talstation', 8, '#1e88e5', '08:00') returning id
  ), a as (
    insert into data.appointment (scheduling, deadline, meeting_point, max_people, description, state, school_id, instructor_id, appointment_type_id)
    select date_trunc('day', now()) + make_interval(days => d) + interval '8 hours',
           date_trunc('day', now()) + make_interval(days => d - 1) + interval '18 hours',
           'Talstation', 8, 'Bring your own glider.', 'CONFIRMED', ${schoolId},
           (select id from data.app_user where email = ${q(school.instructor.email)}), t.id
    from t, unnest(array[${school.appointmentsInDays.join(',')}]) as d
    returning id, scheduling
  )
  insert into data.subscription (appointment_id, user_id, comment)
  select id, ${userId}, 'See you there' from a order by scheduling limit 1`);
psql(`
  with th as (insert into data.training_hill (auslegen, aufziehen, starts, landungen) values (3, 2, 1, 1) returning id),
       th2 as (insert into data.theory (fluglehre, wetterkunde) values (2, 1) returning id),
       af as (insert into data.altitude_flight (kreise, acht, landevolte) values (2, 1, 3) returning id),
       lv as (insert into data.level (start, maneuver, landing) values (2, 1, 1) returning id)
  insert into data.control_sheet (user_id, "trainingHillId", "theoryId", "altitudeFlightId", "levelId")
  select ${userId}, th.id, th2.id, af.id, lv.id from th, th2, af, lv`);
for (const [i, p] of school.passengers.entries()) {
  psql(`insert into data.passenger_confirmation
          (firstname, lastname, email, phone, place, date, signature, signature_mime_type, can_use_data, user_id, tandem_school_id)
        values (${q(p.firstname)}, ${q(p.lastname)}, ${q(`${p.firstname.toLowerCase()}@local.test`)}, '+41790000001', ${q(p.place)},
                current_date - ${i + 1}, ${q(signature)}, 'image/png', true, ${userId}, ${schoolId})`);
}
const ec = school.emergencyContact;
psql(`insert into data.emergency_contact (firstname, lastname, phone, user_id)
      values (${q(ec.firstname)}, ${q(ec.lastname)}, ${q(ec.phone)}, ${userId})`);

const now = Math.floor(Date.now() / 1000);
const token = sign({ sub: Number(userId), email: user.email, iat: now, exp: now + 30 * 24 * 3600 });
fs.mkdirSync(AUTH_DIR, { recursive: true });
fs.writeFileSync(AUTH_DIR + 'token.txt', token);

const api = async (method, path, body) => {
  const r = await fetch(API_URL + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
};

// Place coordinates are stored as EPSG:3857.
const mercator = ([lng, lat]) => [
  (lng * 20037508.34) / 180,
  Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 6378137,
];

const places = [];
for (const { lngLat, ...p } of SEED.places) places.push(await api('POST', '/places', { ...p, coordinates: mercator(lngLat) }));
const gliders = [];
for (const g of SEED.gliders) gliders.push(await api('POST', '/gliders', g));
for (let i = 0; i < SEED.flightCount; i++) {
  await api('POST', '/flights', {
    date: new Date(Date.UTC(2026, 3 + (i % 6), 1 + i * 2)).toISOString().slice(0, 10),
    glider: gliders[i % gliders.length],
    start: places[i % 3 === 2 ? 2 : 0],
    landing: places[1],
    time: `00:${String(10 + i * 4).padStart(2, '0')}:00`,
    km: 3 + i,
    price: i % 4 ? 0 : 25,
    description: `Test flight ${i + 1}. Smooth thermals.`,
    shvAlone: false,
  });
}
console.log(`seeded user #${userId}: ${places.length} places, ${gliders.length} gliders, ${SEED.flightCount} flights, school #${schoolId}`);
