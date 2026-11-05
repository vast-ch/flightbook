import { User } from '../domain/user.entity';

export const USER_EMAIL_CHANGED = 'user.email-changed';

export class UserEmailChangedEvent {
    constructor(
        public readonly user: User,
        public readonly oldEmail: string
    ) {}
}
