import { I18nContext } from 'nestjs-i18n';
import { EmailService } from './email.service';
import { EmailBodyDto } from './email-body-dto';
import { User } from '../user/domain/user.entity';
import { Subscription } from '../training/subscription/subscription.entity';
import { Appointment } from '../training/appointment/appointment.entity';

describe('EmailService', () => {
  let service: EmailService;

  beforeAll(async () => {
    service = new EmailService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendAppointmentDeleted', () => {
    let sendEmail: jest.SpyInstance;

    beforeEach(() => {
      sendEmail = jest.spyOn(service, 'sendEmail').mockResolvedValue(true);
      // Renders "key|lang|args" so the test sees what went into the translation.
      jest.spyOn(I18nContext, 'current').mockReturnValue({
        t: (key: string, options: any) => `${key}|${options.lang}|${JSON.stringify(options.args ?? {})}`,
      } as any);
    });

    function subscription(email: string, emailNotification = true): Subscription {
      const user = new User();
      user.email = email;
      jest.spyOn(user, 'isAppointmentEmailNotificationEnabled').mockReturnValue(emailNotification);
      const subscription = new Subscription();
      subscription.user = user;
      return subscription;
    }

    function appointment(): Appointment {
      return {
        scheduling: new Date('2030-05-04T08:30:00Z'),
        meetingPoint: 'Fiesch',
        instructor: { email: 'instructor@school.ch' },
        school: { name: 'Flugschule', language: 'de', email: 'school@school.ch' },
      } as any;
    }

    function sentEmail(): EmailBodyDto {
      expect(sendEmail).toHaveBeenCalledTimes(1);
      return sendEmail.mock.calls[0][0];
    }

    it('sends one mail to every subscriber in bcc, in the school language', () => {
      service.sendAppointmentDeleted(appointment(), [subscription('a@student.com'), subscription('b@student.com')]);

      const email = sentEmail();
      expect(email.bccAddress).toEqual('a@student.com;b@student.com;');
      expect(email.replyTo).toEqual('instructor@school.ch');
      expect(email.subject).toContain('email.appointment.deleted.subject|de|');
      expect(email.subject).toContain('04.05.2030 08:30');
      expect(email.content).toContain('email.appointment.deleted.content|de|');
      expect(email.content).toContain('Fiesch');
    });

    it('skips subscribers who switched appointment e-mails off', () => {
      service.sendAppointmentDeleted(appointment(), [subscription('a@student.com', false), subscription('b@student.com')]);

      expect(sentEmail().bccAddress).toEqual('b@student.com;');
    });

    it('sends nothing when every subscriber switched appointment e-mails off', () => {
      service.sendAppointmentDeleted(appointment(), [subscription('a@student.com', false)]);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('escapes the instructor message', () => {
      service.sendAppointmentDeleted(appointment(), [subscription('a@student.com')], '<b>Bad</b> weather\nSee you & bye');

      const content = sentEmail().content;
      expect(content).toContain('&lt;b&gt;Bad&lt;/b&gt; weather</br>See you &amp; bye');
      expect(content).not.toContain('<b>Bad</b>');
    });
  });
});
