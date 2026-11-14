import * as request from 'supertest';
import { BaseE2ETest } from '../base-e2e-test';
import { JwtTestHelper } from '../jwt-helper';
import { Testdata } from '../testdata';
import { Subscription } from '../../src/training/subscription/subscription.entity';
import { Appointment } from '../../src/training/appointment/appointment.entity';
import { School } from '../../src/training/school/domain/school.entity';
import { User } from '../../src/user/domain/user.entity';

// Places are given strictly in subscription order: once someone does not fit,
// everyone after them waits too. So a cancellation can only move people up,
// never take a place away. And every waiting-list change an instructor makes
// informs the students who moved up, like a student's own cancellation does.
describe('appointment waiting list order and notifications (e2e)', () => {
  const testInstance = new BaseE2ETest();
  let informWaitingStudent: jest.SpyInstance;
  let informSubscription: jest.SpyInstance;

  beforeEach(async () => {
    await testInstance.cleanupBetweenTests();
    informWaitingStudent = jest.spyOn(testInstance.appointmentEmailService, 'sendInformWaitingStudent').mockImplementation(() => undefined);
    jest.spyOn(testInstance.notificationsService, 'sendInformWaitingStudent').mockImplementation(async () => undefined);
    informSubscription = jest.spyOn(testInstance.appointmentEmailService, 'sendAppointmentSubscription').mockImplementation(() => undefined);
    jest.spyOn(testInstance.notificationsService, 'sendAppointmentSubscription').mockImplementation(async () => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Subscribes students in the given order (1 minute apart). `tandem` students take 2 places. */
  async function givenAppointment(maxPeople: number, subscribers: { name: string; tandem?: boolean }[]) {
    const { instructorUser, testSchool, appointments } = await testInstance.createSchoolDataWithAppointment();
    const appointment = appointments[0];
    appointment.maxPeople = maxPeople;
    await testInstance.appointmentRepository.save(appointment);

    const users: Record<string, User> = {};
    for (const [i, subscriber] of subscribers.entries()) {
      const user = await testInstance.userRepository.save(Testdata.createUser(`${subscriber.name}@student.com`, subscriber.name, 'student'));
      const student = Testdata.createStudent(user, testSchool);
      student.isTandem = !!subscriber.tandem;
      await testInstance.studentRepository.save(student);

      const subscription = new Subscription();
      subscription.appointment = appointment;
      subscription.user = user;
      subscription.timestamp = new Date(Date.UTC(2025, 10, 1, 8, i));
      await testInstance.subscriptionRepository.save(subscription);
      users[subscriber.name] = user;
    }
    return { instructorUser, testSchool, appointment, users };
  }

  /** A student of the school who is not subscribed (yet). */
  async function givenStudent(school: School, name: string) {
    const user = await testInstance.userRepository.save(Testdata.createUser(`${name}@student.com`, name, 'student'));
    await testInstance.studentRepository.save(Testdata.createStudent(user, school));
    return user;
  }

  /** Emails of the students informed that an instructor subscribed them. */
  function subscribedStudents() {
    return informSubscription.mock.calls.flatMap(([students]) => students.map((student: any) => student.user.email));
  }

  function token(user: User) {
    return JwtTestHelper.createKeycloakToken({ sub: user.id, email: user.email });
  }

  /** email → waitingList, as the instructor appointment list reports it. */
  async function waitingListByEmail(instructorUser: User, school: School, appointment: Appointment) {
    const response = await request(testInstance.app.getHttpServer())
      .get(`/instructor/schools/${school.id}/appointments`)
      .set('Authorization', `Bearer ${token(instructorUser)}`)
      .expect(200);
    const dto = response.body.entity.find((a: any) => a.id === appointment.id);
    return {
      dto,
      waiting: new Map<string, boolean>(dto.subscriptions.map((s: any) => [s.user.email, s.waitingList])),
    };
  }

  /** Saves the appointment like the instructor app does: subscribers carry the full user (with id). */
  async function putAppointment(instructorUser: User, school: School, appointment: Appointment, change: { maxPeople: number; subscribers: string[] }) {
    const subscriptions = [];
    for (const name of change.subscribers) {
      const user = await testInstance.getUserByEmail(`${name}@student.com`);
      subscriptions.push({ user: { id: user.id, email: user.email, firstname: user.firstname, lastname: user.lastname } });
    }
    return request(testInstance.app.getHttpServer())
      .put(`/instructor/schools/${school.id}/appointments/${appointment.id}`)
      .set('Authorization', `Bearer ${token(instructorUser)}`)
      .send({
        id: appointment.id,
        scheduling: appointment.scheduling,
        state: appointment.state,
        maxPeople: change.maxPeople,
        instructor: { email: instructorUser.email },
        subscriptions,
        guestSubscriptions: [],
      })
      .expect(200);
  }

  /** [email, position, canParticipate] of every waiting-list email sent. */
  function informedStudents() {
    return informWaitingStudent.mock.calls.map(([, , subscription, position, canParticipate]) => [subscription.user.email, position, canParticipate]);
  }

  it('nobody overtakes: once someone does not fit, everyone after waits', async () => {
    // given: max 5 — 4 singles (4 places), tandem (2) does not fit, then a single
    const { instructorUser, testSchool, appointment } = await givenAppointment(5, [
      { name: 's1' }, { name: 's2' }, { name: 's3' }, { name: 's4' }, { name: 'tandem', tandem: true }, { name: 's5' },
    ]);

    // when
    const { dto, waiting } = await waitingListByEmail(instructorUser, testSchool, appointment);

    // then
    expect(waiting.get('tandem@student.com')).toBe(true);
    expect(waiting.get('s5@student.com')).toBe(true);
    expect(dto.countSubscription).toEqual(4);
    expect(dto.countWaitingList).toEqual(3);
  });

  it('a cancellation never takes a place away', async () => {
    // given
    const { instructorUser, testSchool, appointment, users } = await givenAppointment(5, [
      { name: 's1' }, { name: 's2' }, { name: 's3' }, { name: 's4' }, { name: 'tandem', tandem: true }, { name: 's5' },
    ]);
    const before = (await waitingListByEmail(instructorUser, testSchool, appointment)).waiting;

    // when: s1 unsubscribes
    await request(testInstance.app.getHttpServer())
      .delete(`/student/schools/${testSchool.id}/appointments/${appointment.id}/subscriptions`)
      .set('Authorization', `Bearer ${token(users.s1)}`)
      .expect(204);

    // then: everyone who had a place still has it; the tandem moved up
    const after = (await waitingListByEmail(instructorUser, testSchool, appointment)).waiting;
    for (const [email, wasWaiting] of before) {
      if (!wasWaiting && after.has(email)) {
        expect({ email, waiting: after.get(email) }).toEqual({ email, waiting: false });
      }
    }
    expect(after.get('tandem@student.com')).toBe(false);
    expect(after.get('s5@student.com')).toBe(true);
  });

  it('instructor removes a subscriber → the next one is informed they can participate', async () => {
    // given
    const { instructorUser, testSchool, appointment } = await givenAppointment(1, [{ name: 'a' }, { name: 'b' }]);

    // when
    await putAppointment(instructorUser, testSchool, appointment, { maxPeople: 1, subscribers: ['b'] });

    // then
    expect(informedStudents()).toEqual([['b@student.com', 0, true]]);
  });

  it('instructor raises max people → everyone who gets a place is informed', async () => {
    // given
    const { instructorUser, testSchool, appointment } = await givenAppointment(1, [{ name: 'a' }, { name: 'b' }, { name: 'c' }]);

    // when
    await putAppointment(instructorUser, testSchool, appointment, { maxPeople: 3, subscribers: ['a', 'b', 'c'] });

    // then
    expect(informedStudents()).toEqual([['b@student.com', 0, true], ['c@student.com', 0, true]]);
  });

  it('instructor removes a subscriber → waiting students are informed of their new position', async () => {
    // given
    const { instructorUser, testSchool, appointment } = await givenAppointment(1, [{ name: 'a' }, { name: 'b' }, { name: 'c' }]);

    // when
    await putAppointment(instructorUser, testSchool, appointment, { maxPeople: 1, subscribers: ['b', 'c'] });

    // then
    expect(informedStudents()).toEqual([['b@student.com', 0, true], ['c@student.com', 1, false]]);
  });

  it('instructor adds a student who gets a place → the student is informed', async () => {
    // given
    const { instructorUser, testSchool, appointment } = await givenAppointment(2, [{ name: 'a' }]);
    await givenStudent(testSchool, 'd');

    // when
    await putAppointment(instructorUser, testSchool, appointment, { maxPeople: 2, subscribers: ['a', 'd'] });

    // then
    expect(subscribedStudents()).toEqual(['d@student.com']);
  });

  it('instructor adds a student who lands on the waiting list → the student is not informed', async () => {
    // given
    const { instructorUser, testSchool, appointment } = await givenAppointment(1, [{ name: 'a' }]);
    await givenStudent(testSchool, 'd');

    // when
    await putAppointment(instructorUser, testSchool, appointment, { maxPeople: 1, subscribers: ['a', 'd'] });

    // then
    expect(subscribedStudents()).toEqual([]);
  });
});
