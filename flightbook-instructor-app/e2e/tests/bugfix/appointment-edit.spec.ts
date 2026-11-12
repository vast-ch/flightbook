// Reported bug: an ANNOUNCED appointment, max 12 people, 17 subscriptions
// (5 on the waiting list). The instructor sets state CONFIRMED + max 17 and
// saves → the state stays ANNOUNCED and all subscriptions are gone.
//
// Cause: the edit dialog rebuilt every existing subscription from the
// separately loaded student list (GET /instructor/schools/:id/students?archived=false).
// A subscriber missing from that list — list not loaded yet, or student
// archived — was sent as `{}`; the API deleted the subscriptions, then
// crashed with a 500 before saving the appointment.
//
// These tests describe the *expected* behaviour and only rely on what a user
// sees (names in the dialog, the add button) and on the database outcome.
import type { Page } from '@playwright/test';
import { expect, isStudentsRequest, psql, schoolId, test, token, waitForAppointments } from '../fixtures';
import { API_URL, SEED } from '../seed-data.js';

const OUT = 'out/screens';
const NAMES = SEED.students.map((s) => `${s.firstname} ${s.lastname}`);
const ARCHIVED = SEED.students.slice(-2).map((s) => s.email); // student16, student17
let appointmentId: number;

test.beforeEach(() => {
  // 3 days ahead → "upcoming" tab. Subscriptions 1 s apart, so order (and
  // with max 12, the waiting list) is the same as in the report.
  appointmentId = Number(
    psql(`insert into data.appointment (scheduling, deadline, meeting_point, max_people, description, state, school_id, instructor_id)
          select date_trunc('day', now()) + interval '3 days 8 hours', date_trunc('day', now()) + interval '2 days 18 hours',
                 'Talstation', 12, 'Bug repro', 'ANNOUNCED', ${schoolId()}, (select id from data.app_user where email = '${SEED.instructor.email}')
          returning id`),
  );
  psql(`insert into data.subscription (appointment_id, user_id, timestamp)
        select ${appointmentId}, u.id, now() - interval '1 hour' + make_interval(secs => row_number() over (order by u.email))
        from data.app_user u join data.student s on s.user_id = u.id where s.school_id = ${schoolId()}`);
});

test.afterEach(() => {
  psql(`delete from data.subscription where appointment_id = ${appointmentId}`);
  psql(`delete from data.appointment where id = ${appointmentId}`);
  psql(`update data.student set "isArchived" = false, "isAppointmentActive" = true where school_id = ${schoolId()}`);
});

const dbState = () => {
  const [state, subs] = psql(
    `select a.state, (select count(*) from data.subscription s where s.appointment_id = a.id) from data.appointment a where a.id = ${appointmentId}`,
  ).split('|');
  return { state, subscriptions: Number(subs) };
};

const dialog = (page: Page) => page.locator('mat-dialog-container');
const addStudentButton = (page: Page) => dialog(page).getByRole('button', { name: 'Schüler*in anmelden', exact: true });

async function openEditDialog(page: Page) {
  await page.getByRole('button', { name: 'Termin bearbeiten' }).first().click();
  await expect(dialog(page)).toBeVisible();
}

/** Every one of the 17 subscribers is shown by name in the dialog. */
async function expectAllSubscribersShown(page: Page) {
  for (const name of NAMES) {
    await expect(dialog(page).getByText(name, { exact: true }), `${name} shown in dialog`).toBeVisible();
  }
}

async function screenshots(page: Page, name: string) {
  await addStudentButton(page).scrollIntoViewIfNeeded();
  await dialog(page).screenshot({ path: `${OUT}/${name}-subscriptions.png` });
}

/** Same edit as the reporting user: state → Bestätigt, max people → 17, save. */
async function confirmWith17AndSave(page: Page) {
  await page.locator('mat-select[formcontrolname="state"]').click();
  await page.getByRole('option', { name: 'Bestätigt' }).click();
  await page.locator('input[formcontrolname="maxPeople"]').fill('17');
  const put = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/appointments\/\d+$/.test(r.url()));
  await page.getByRole('button', { name: 'Speichern' }).click();
  return (await put).status();
}

test('students loaded before opening → edit keeps all subscriptions', async ({ page }) => {
  expect(dbState()).toEqual({ state: 'ANNOUNCED', subscriptions: 17 });

  const students = page.waitForResponse((r) => /\/instructor\/schools\/\d+\/students\?/.test(r.url()));
  await page.goto('/appointments');
  await students;
  await waitForAppointments(page);
  await openEditDialog(page);

  await expectAllSubscribersShown(page);
  await expect(addStudentButton(page)).toBeEnabled();
  await screenshots(page, 'loaded');

  expect(await confirmWith17AndSave(page)).toBe(200);
  await expect.poll(dbState).toEqual({ state: 'CONFIRMED', subscriptions: 17 });
});

test('students request still pending → subscribers shown, adding blocked, edit keeps all subscriptions', async ({ page }) => {
  await page.route(isStudentsRequest, () => {}); // never answers

  await page.goto('/appointments');
  await waitForAppointments(page);
  await openEditDialog(page);

  await expectAllSubscribersShown(page);
  await expect(addStudentButton(page)).toBeDisabled(); // nothing to choose from yet
  await screenshots(page, 'pending');

  expect(await confirmWith17AndSave(page)).toBe(200);
  await expect.poll(dbState).toEqual({ state: 'CONFIRMED', subscriptions: 17 });
});

test('slow students request → dialog opened early picks the list up once it arrives', async ({ page }) => {
  await page.route(isStudentsRequest, async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.continue();
  });
  const studentsLoaded = page.waitForResponse((r) => /\/instructor\/schools\/\d+\/students\?/.test(r.url()), { timeout: 20_000 });

  await page.goto('/appointments');
  await waitForAppointments(page);
  await openEditDialog(page);

  await expectAllSubscribersShown(page);
  await expect(addStudentButton(page)).toBeDisabled();
  await studentsLoaded;
  await expect(addStudentButton(page)).toBeEnabled();
  await screenshots(page, 'slow');

  expect(await confirmWith17AndSave(page)).toBe(200);
  await expect.poll(dbState).toEqual({ state: 'CONFIRMED', subscriptions: 17 });
});

test('archived subscribers → shown in the dialog and kept on edit', async ({ page }) => {
  // student16: archived but still allowed to book appointments;
  // student17: archived without appointment access. Both stay subscribed.
  psql(`update data.student set "isArchived" = true, "isAppointmentActive" = (u.email = '${ARCHIVED[0]}')
        from data.app_user u where u.id = data.student.user_id and u.email in ('${ARCHIVED.join("','")}')`);

  const students = page.waitForResponse((r) => /\/instructor\/schools\/\d+\/students\?/.test(r.url()));
  await page.goto('/appointments');
  await students;
  await waitForAppointments(page);
  await openEditDialog(page);

  await expectAllSubscribersShown(page);
  await screenshots(page, 'archived');

  expect(await confirmWith17AndSave(page)).toBe(200);
  await expect.poll(dbState).toEqual({ state: 'CONFIRMED', subscriptions: 17 });
});

test('adding a student → only students not yet subscribed can be chosen', async ({ page }) => {
  // 15 of the 17 students are subscribed; student16 and student17 are not.
  psql(`delete from data.subscription s using data.app_user u
        where s.user_id = u.id and s.appointment_id = ${appointmentId} and u.email in ('${ARCHIVED.join("','")}')`);
  const [student16, student17] = NAMES.slice(-2);

  const students = page.waitForResponse((r) => /\/instructor\/schools\/\d+\/students\?/.test(r.url()));
  await page.goto('/appointments');
  await students;
  await waitForAppointments(page);
  await openEditDialog(page);

  // first new row: the two students who are not subscribed
  await addStudentButton(page).click();
  await dialog(page).getByRole('combobox', { name: 'Schüler*in' }).last().click();
  await expect(page.getByRole('option')).toHaveText([student16, student17]);
  await page.getByRole('option', { name: student16 }).click();

  // second new row: the student just picked is gone as well
  await addStudentButton(page).click();
  await dialog(page).getByRole('combobox', { name: 'Schüler*in' }).last().click();
  await expect(page.getByRole('option')).toHaveText([student17]);
});

test('API rejects a subscription without user and changes nothing', async ({ request }) => {
  const valid = SEED.students.slice(0, 16).map((s) => ({ user: { email: s.email } }));
  const response = await request.put(`${API_URL}/instructor/schools/${schoolId()}/appointments/${appointmentId}`, {
    headers: { Authorization: `Bearer ${token()}` },
    data: {
      id: appointmentId,
      scheduling: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      state: 'CONFIRMED',
      maxPeople: 17,
      instructor: {},
      takeOffCoordinator: {},
      type: {},
      guestSubscriptions: [],
      subscriptions: [...valid, {}],
    },
  });

  expect(response.status()).toBe(400);
  expect(dbState()).toEqual({ state: 'ANNOUNCED', subscriptions: 17 });
});
