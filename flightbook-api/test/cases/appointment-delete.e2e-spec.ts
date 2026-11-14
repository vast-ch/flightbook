import * as request from 'supertest';
import { BaseE2ETest } from '../base-e2e-test';
import { JwtTestHelper } from '../jwt-helper';
import { Testdata } from '../testdata';
import { Subscription } from '../../src/training/subscription/subscription.entity';
import { GuestSubscription } from '../../src/training/subscription/guest-subscription.entity';
import { Appointment } from '../../src/training/appointment/appointment.entity';
import { User } from '../../src/user/domain/user.entity';

// An instructor deletes an appointment: it disappears with its subscriptions and
// guest subscriptions, and every subscribed student (waiting list included) is
// told by e-mail and push notification - unless the appointment is already past.
describe('instructor deletes an appointment (e2e)', () => {
  const testInstance = new BaseE2ETest();
  let deletedEmail: jest.SpyInstance;
  let deletedNotification: jest.SpyInstance;

  beforeEach(async () => {
    await testInstance.cleanupBetweenTests();
    deletedEmail = jest.spyOn(testInstance.appointmentEmailService, 'sendAppointmentDeleted').mockImplementation(() => undefined);
    deletedNotification = jest.spyOn(testInstance.notificationsService, 'sendAppointmentDeleted').mockImplementation(async () => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function daysFromNow(days: number) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  /** An appointment (max 1 person) with the given students subscribed in order and the given guests. */
  async function givenAppointment(scheduling: Date, subscribers: string[], guests: string[] = []) {
    const { instructorUser, testSchool, appointments } = await testInstance.createSchoolDataWithAppointment();
    const appointment: Appointment = appointments[0];
    appointment.scheduling = scheduling;
    appointment.maxPeople = 1;
    await testInstance.appointmentRepository.save(appointment);

    for (const [i, name] of subscribers.entries()) {
      const user = await testInstance.userRepository.save(Testdata.createUser(`${name}@student.com`, name, 'student'));
      await testInstance.studentRepository.save(Testdata.createStudent(user, testSchool));

      const subscription = new Subscription();
      subscription.appointment = appointment;
      subscription.user = user;
      subscription.timestamp = new Date(Date.UTC(2025, 10, 1, 8, i));
      await testInstance.subscriptionRepository.save(subscription);
    }

    for (const name of guests) {
      const guestSubscription = new GuestSubscription();
      guestSubscription.appointment = appointment;
      guestSubscription.firstname = name;
      guestSubscription.lastname = 'guest';
      await testInstance.guestSubscriptionRepository.save(guestSubscription);
    }

    return { instructorUser, testSchool, appointment };
  }

  function token(user: User) {
    return JwtTestHelper.createKeycloakToken({ sub: user.id, email: user.email });
  }

  function deleteAppointment(user: User, schoolId: number, appointmentId: number, body?: object) {
    const req = request(testInstance.app.getHttpServer())
      .delete(`/instructor/schools/${schoolId}/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${token(user)}`);
    return body ? req.send(body) : req;
  }

  /** E-mails of the subscribers handed to a notification spy, per call. */
  function notifiedSubscribers(spy: jest.SpyInstance) {
    return spy.mock.calls.map(([, subscriptions]) => subscriptions.map((subscription: Subscription) => subscription.user.email));
  }

  async function expectAppointmentGone(appointment: Appointment) {
    expect(await testInstance.appointmentRepository.findOne({ where: { id: appointment.id } })).toBeNull();
    expect(await testInstance.subscriptionRepository.count({ where: { appointment: { id: appointment.id } } })).toEqual(0);
    expect(await testInstance.guestSubscriptionRepository.count({ where: { appointment: { id: appointment.id } } })).toEqual(0);
  }

  it('deletes an upcoming appointment and notifies every subscriber by e-mail and push', async () => {
    // given: max 1 person - "a" has the place, "b" is on the waiting list, plus a guest
    const { instructorUser, testSchool, appointment } = await givenAppointment(daysFromNow(7), ['a', 'b'], ['guest']);

    // when
    await deleteAppointment(instructorUser, testSchool.id, appointment.id, { message: 'Bad weather' }).expect(204);

    // then
    await expectAppointmentGone(appointment);
    expect(notifiedSubscribers(deletedEmail)).toEqual([['a@student.com', 'b@student.com']]);
    expect(notifiedSubscribers(deletedNotification)).toEqual([['a@student.com', 'b@student.com']]);

    const [emailAppointment, , emailMessage] = deletedEmail.mock.calls[0];
    expect(emailAppointment.id).toEqual(appointment.id);
    expect(emailAppointment.school.id).toEqual(testSchool.id);
    expect(emailMessage).toEqual('Bad weather');
    expect(deletedNotification.mock.calls[0][2]).toEqual('Bad weather');
  });

  it('works without a message', async () => {
    // given
    const { instructorUser, testSchool, appointment } = await givenAppointment(daysFromNow(7), ['a']);

    // when
    await deleteAppointment(instructorUser, testSchool.id, appointment.id).expect(204);

    // then
    await expectAppointmentGone(appointment);
    expect(notifiedSubscribers(deletedEmail)).toEqual([['a@student.com']]);
    expect(deletedEmail.mock.calls[0][2]).toBeUndefined();
  });

  it('deletes a past appointment without notifying anyone', async () => {
    // given
    const { instructorUser, testSchool, appointment } = await givenAppointment(daysFromNow(-7), ['a', 'b'], ['guest']);

    // when
    await deleteAppointment(instructorUser, testSchool.id, appointment.id, { message: 'Clean up' }).expect(204);

    // then
    await expectAppointmentGone(appointment);
    expect(deletedEmail).not.toHaveBeenCalled();
    expect(deletedNotification).not.toHaveBeenCalled();
  });

  it('deletes an appointment nobody subscribed to without notifying anyone', async () => {
    // given
    const { instructorUser, testSchool, appointment } = await givenAppointment(daysFromNow(7), []);

    // when
    await deleteAppointment(instructorUser, testSchool.id, appointment.id).expect(204);

    // then
    await expectAppointmentGone(appointment);
    expect(deletedEmail).not.toHaveBeenCalled();
    expect(deletedNotification).not.toHaveBeenCalled();
  });

  it('leaves the other appointments of the school alone', async () => {
    // given
    const { instructorUser, testSchool, appointment } = await givenAppointment(daysFromNow(7), ['a']);

    // when
    await deleteAppointment(instructorUser, testSchool.id, appointment.id).expect(204);

    // then: createSchoolDataWithAppointment made 4 appointments
    expect(await testInstance.appointmentRepository.count()).toEqual(3);
  });

  it('answers 404 for an unknown appointment', async () => {
    // given
    const { instructorUser, testSchool } = await givenAppointment(daysFromNow(7), []);

    // when / then
    await deleteAppointment(instructorUser, testSchool.id, 999999).expect(404);
  });

  it('refuses a user who is not in the school team', async () => {
    // given
    const { testSchool, appointment } = await givenAppointment(daysFromNow(7), ['a']);
    const student = await testInstance.getUserByEmail('a@student.com');

    // when
    await deleteAppointment(student, testSchool.id, appointment.id).expect(403);

    // then
    expect(await testInstance.appointmentRepository.findOne({ where: { id: appointment.id } })).not.toBeNull();
    expect(deletedEmail).not.toHaveBeenCalled();
  });

  it('refuses to delete an appointment of another school', async () => {
    // given: the instructor of a second school targets the first school's appointment
    const { appointment } = await givenAppointment(daysFromNow(7), ['a']);
    const other = await testInstance.createSchoolData('student2@student.com', 'instructor2@instructor.com', 'other school', 'tandem2@tandem-pilot.com');

    // when
    await deleteAppointment(other.instructorUser, other.testSchool.id, appointment.id).expect(404);

    // then
    expect(await testInstance.appointmentRepository.findOne({ where: { id: appointment.id } })).not.toBeNull();
    expect(await testInstance.subscriptionRepository.count()).toEqual(1);
    expect(deletedEmail).not.toHaveBeenCalled();
    expect(deletedNotification).not.toHaveBeenCalled();
  });
});
