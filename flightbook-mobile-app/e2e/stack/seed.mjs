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
console.log(`seeded user #${userId}: ${places.length} places, ${gliders.length} gliders, ${SEED.flightCount} flights`);
