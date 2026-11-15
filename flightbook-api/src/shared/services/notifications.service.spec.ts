import { I18nContext } from 'nestjs-i18n';
import { getMessaging } from 'firebase-admin/messaging';
import { NotificationsService } from './notifications.service';
import { UserRepository } from '../../user/user.repository';

jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(),
}));

describe('NotificationsService', () => {
  let service: NotificationsService;
  let userRepository: jest.Mocked<UserRepository>;

  beforeAll(async () => {
    userRepository = { clearNotificationTokens: jest.fn() } as any;
    service = new NotificationsService(userRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendAppointmentDeleted', () => {
    let sendEachForMulticast: jest.Mock;

    beforeEach(() => {
      sendEachForMulticast = jest.fn().mockResolvedValue({ responses: [] });
      (getMessaging as jest.Mock).mockReturnValue({ sendEachForMulticast });
      userRepository.clearNotificationTokens.mockClear();
      jest.spyOn(I18nContext, 'current').mockReturnValue({
        t: (key: string, options: any) => `${key}|${options.lang}|${JSON.stringify(options.args ?? {})}`,
      } as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    const appointment: any = {
      id: 7,
      scheduling: new Date('2030-05-04T08:30:00Z'),
      meetingPoint: 'Fiesch',
      school: { id: 3, name: 'Flugschule', language: 'de' },
    };

    function subscription(notificationToken?: string): any {
      return { user: { notificationToken } };
    }

    it('sends an APPOINTMENT_DELETED push to every subscriber with a token', async () => {
      await service.sendAppointmentDeleted(appointment, [subscription('token-a'), subscription(), subscription('token-b')]);

      expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
      const message = sendEachForMulticast.mock.calls[0][0];
      expect(message.tokens).toEqual(['token-a', 'token-b']);
      expect(message.notification.title).toEqual('notification.appointment.deleted.title|de|{}');
      expect(message.notification.body).toContain('04.05.2030 08:30');
      // the app shows title and body in an alert after the tap, so they travel in data too
      expect(message.data).toEqual({
        type: 'APPOINTMENT_DELETED',
        schoolId: '3',
        title: message.notification.title,
        body: message.notification.body,
      });
    });

    it('appends the instructor message to the body', async () => {
      await service.sendAppointmentDeleted(appointment, [subscription('token-a')], 'Bad weather');

      const message = sendEachForMulticast.mock.calls[0][0];
      expect(message.notification.body.endsWith('\r\nBad weather')).toBe(true);
      expect(message.data.body).toEqual(message.notification.body);
    });

    it('sends nothing when no subscriber has a token', async () => {
      await service.sendAppointmentDeleted(appointment, [subscription()]);

      expect(sendEachForMulticast).not.toHaveBeenCalled();
    });

    it('clears the tokens Firebase rejected', async () => {
      sendEachForMulticast.mockResolvedValue({ responses: [{ success: true }, { success: false }] });

      await service.sendAppointmentDeleted(appointment, [subscription('token-a'), subscription('token-b')]);

      expect(userRepository.clearNotificationTokens).toHaveBeenCalledWith(['token-b']);
    });
  });
});
