import * as request from 'supertest';
import { BaseE2ETest } from '../base-e2e-test';
import { JwtTestHelper } from '../jwt-helper';
import { Testdata } from '../testdata';
import { Subscription } from '../../src/training/subscription/subscription.entity';

// A subscription keeps its place, whatever happens to the student afterwards.
// Subscriber A was archived without appointment access after subscribing; the
// waiting list must still count A, so the history of an appointment stays
// correct and other students can still unsubscribe.
describe('appointment waiting list with archived subscriber (e2e)', () => {
  const testInstance = new BaseE2ETest();

  beforeEach(async () => {
    await testInstance.cleanupBetweenTests();
  });

  async function givenAppointmentWithArchivedFirstSubscriber() {
    const { studentUser, instructorUser, testSchool, appointments } = await testInstance.createSchoolDataWithAppointment();
    const appointment = appointments[0]; // maxPeople = 1, no deadline

    const archivedUser = await testInstance.userRepository.save(Testdata.createUser('archived@student.com', 'archived', 'student'));
    const archivedStudent = Testdata.createStudent(archivedUser, testSchool);
    archivedStudent.isArchived = true;
    archivedStudent.isAppointmentActive = false;
    await testInstance.studentRepository.save(archivedStudent);

    // A (archived) subscribed first, B (active) second.
    const first = new Subscription();
    first.appointment = appointment;
    first.user = archivedUser;
    first.timestamp = new Date('2025-11-01T08:00:00Z');
    await testInstance.subscriptionRepository.save(first);

    const second = new Subscription();
    second.appointment = appointment;
    second.user = studentUser;
    second.timestamp = new Date('2025-11-01T09:00:00Z');
    await testInstance.subscriptionRepository.save(second);

    return { studentUser, instructorUser, testSchool, appointment, archivedUser };
  }

  function expectArchivedSubscriberKeepsPlace(appointmentDto: any, archivedEmail: string, activeEmail: string) {
    expect(appointmentDto.countSubscription).toEqual(1);
    expect(appointmentDto.countWaitingList).toEqual(1);
    expect(appointmentDto.subscriptions).toHaveLength(2);

    const [archived, active] = appointmentDto.subscriptions;
    expect(archived.user.email).toEqual(archivedEmail);
    expect(archived.waitingList).toBe(false);
    expect(archived.student).toBeDefined();
    expect(archived.student.isArchived).toBe(true);

    expect(active.user.email).toEqual(activeEmail);
    expect(active.waitingList).toBe(true);
  }

  it('/instructor/schools/:id/appointments (GET) counts the archived subscriber', async () => {
    // given
    const { instructorUser, studentUser, testSchool, appointment, archivedUser } = await givenAppointmentWithArchivedFirstSubscriber();
    const keycloakToken = JwtTestHelper.createKeycloakToken({ sub: instructorUser.id, email: instructorUser.email });

    // when
    return request(testInstance.app.getHttpServer())
      .get(`/instructor/schools/${testSchool.id}/appointments`)
      .set('Authorization', `Bearer ${keycloakToken}`)
      .expect(200)
      .then((response) => {
        const appointmentDto = response.body.entity.find((a: any) => a.id === appointment.id);
        expectArchivedSubscriberKeepsPlace(appointmentDto, archivedUser.email, studentUser.email);
      });
  });

  it('/student/schools/:id/appointments/:appointmentId (GET) counts the archived subscriber', async () => {
    // given
    const { studentUser, testSchool, appointment, archivedUser } = await givenAppointmentWithArchivedFirstSubscriber();
    const keycloakToken = JwtTestHelper.createKeycloakToken({ sub: studentUser.id, email: studentUser.email });

    // when
    return request(testInstance.app.getHttpServer())
      .get(`/student/schools/${testSchool.id}/appointments/${appointment.id}`)
      .set('Authorization', `Bearer ${keycloakToken}`)
      .expect(200)
      .then((response) => {
        expectArchivedSubscriberKeepsPlace(response.body, archivedUser.email, studentUser.email);
      });
  });

  it('/student/schools/:schoolId/appointments/:appointmentId/subscriptions (DELETE) works with an archived subscriber', async () => {
    // given
    const { studentUser, testSchool, appointment, archivedUser } = await givenAppointmentWithArchivedFirstSubscriber();
    const keycloakToken = JwtTestHelper.createKeycloakToken({ sub: studentUser.id, email: studentUser.email });

    // when
    return request(testInstance.app.getHttpServer())
      .delete(`/student/schools/${testSchool.id}/appointments/${appointment.id}/subscriptions`)
      .set('Authorization', `Bearer ${keycloakToken}`)
      .expect(204)
      .then(async () => {
        const db = await testInstance.appointmentRepository.findOne({
          relations: { subscriptions: { user: true } },
          where: { id: appointment.id }
        });
        expect(db.subscriptions.map((s) => s.user.email)).toEqual([archivedUser.email]);
      });
  });
});
