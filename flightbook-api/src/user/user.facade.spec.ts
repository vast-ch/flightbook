import { UserFacade } from './user.facade';
import { UserRepository } from './user.repository';
import { AuthService } from '../auth/service/auth.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmailService } from '../email/email.service';
import { KeycloakService } from '../auth/service/keycloak.service';
import { User } from './domain/user.entity';
import { USER_EMAIL_CHANGED, UserEmailChangedEvent } from './event/user-email-changed.event';

describe('User Facade', () => {
  let facade: UserFacade,
      userRepository: jest.Mocked<UserRepository>,
      authService: jest.Mocked<AuthService>,
      eventEmitter: jest.Mocked<EventEmitter2>,
      emailService: jest.Mocked<EmailService>,
      keycloakService: jest.Mocked<KeycloakService>;

  beforeAll(async () => {
    userRepository = {} as any;
    authService = {} as any;
    eventEmitter = { emit: jest.fn() } as any;
    emailService = {} as any;
    keycloakService = {} as any;
    facade = new UserFacade(userRepository, authService, eventEmitter, emailService, keycloakService);
  });

  it('should be defined', () => {
    expect(facade).toBeDefined();
  });

  describe('updateUser', () => {
    const dto = (email: string) => ({ email, firstname: 'Jane', lastname: 'Doe' }) as any;

    beforeEach(() => {
      eventEmitter.emit.mockClear();
      userRepository.getUserById = jest.fn().mockImplementation(async () => ({ id: 1, email: 'old@example.com' }) as User);
      userRepository.getUserByEmail = jest.fn().mockResolvedValue(undefined);
      userRepository.saveUser = jest.fn().mockImplementation(async (user: User) => user);
    });

    it('emits UserEmailChanged with the old email when the email changed', async () => {
      await facade.updateUser(1, dto('new@example.com'));

      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      const [name, event] = eventEmitter.emit.mock.calls[0] as [string, UserEmailChangedEvent];
      expect(name).toBe(USER_EMAIL_CHANGED);
      expect(event.oldEmail).toBe('old@example.com');
      expect(event.user.email).toBe('new@example.com');
    });

    it('emits nothing when the email is unchanged', async () => {
      await facade.updateUser(1, dto('old@example.com'));

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
