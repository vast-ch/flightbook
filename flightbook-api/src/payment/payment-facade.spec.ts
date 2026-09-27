import { PaymentFacade } from './payment-facade';
import { UserRepository } from '../user/user.repository';
import { HttpService } from '@nestjs/axios';
import { EmailService } from '../email/email.service';
import { User } from '../user/domain/user.entity';
import { PaymentState } from './paymentState';

process.env.STRIPE_SECRET_KEY = 'STRIPE_SECRET_KEY';
process.env.STRIPE_ENDPOINT_SECRET = 'STRIPE_ENDPOINT_SECRET';

function buildUser(overrides: Partial<User> = {}): User {
    return { id: 1, email: 'pilot@example.com', paymentExempted: false, ...overrides } as User;
}

function buildStripeSubscription(currentPeriodEndSecondsFromNow: number, cancelAtPeriodEnd: boolean, startDate = 0) {
    return {
        id: 'sub_1',
        cancel_at_period_end: cancelAtPeriodEnd,
        start_date: startDate,
        items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + currentPeriodEndSecondsFromNow }] },
    };
}

describe('Payment Facade', () => {
  let facade: PaymentFacade,
      userRepository: jest.Mocked<UserRepository>,
      httpService: jest.Mocked<HttpService>,
      emailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    httpService = {} as any;
    userRepository = { getUserById: jest.fn() } as any;
    emailService = { sendErrorMessageToAdmin: jest.fn() } as any;
    facade = new PaymentFacade(httpService, userRepository, emailService);
    facade.stripe = {
        customers: { list: jest.fn() },
        subscriptions: { list: jest.fn() },
    } as any;
  });

  it('should be defined', () => {
    expect(facade).toBeDefined();
  });

  describe('hasUserPayed', () => {
    it('reports EXEMPTED for an exempted user with no Stripe subscription', async () => {
        userRepository.getUserById.mockResolvedValue(buildUser({ paymentExempted: true }));
        (facade.stripe.customers.list as jest.Mock).mockResolvedValue({ data: [] });

        const status = await facade.hasUserPayed(1);

        expect(status.state).toBe(PaymentState.EXEMPTED);
        expect(status.active).toBe(true);
    });

    it('overrides EXEMPTED with ACTIVE when a non-expired Stripe subscription exists', async () => {
        userRepository.getUserById.mockResolvedValue(buildUser({ paymentExempted: true }));
        (facade.stripe.customers.list as jest.Mock).mockResolvedValue({ data: [{ id: 'cus_1' }] });
        (facade.stripe.subscriptions.list as jest.Mock).mockResolvedValue({ data: [buildStripeSubscription(3600, false)] });

        const status = await facade.hasUserPayed(1);

        expect(status.state).toBe(PaymentState.ACTIVE);
        expect(status.active).toBe(true);
    });

    it('keeps EXEMPTED (not EXPIRED) for an exempted user with an expired Stripe subscription', async () => {
        userRepository.getUserById.mockResolvedValue(buildUser({ paymentExempted: true }));
        (facade.stripe.customers.list as jest.Mock).mockResolvedValue({ data: [{ id: 'cus_1' }] });
        (facade.stripe.subscriptions.list as jest.Mock).mockResolvedValue({ data: [buildStripeSubscription(-3600, false)] });

        const status = await facade.hasUserPayed(1);

        expect(status.state).toBe(PaymentState.EXEMPTED);
        expect(status.active).toBe(true);
    });

    it('reports NONE for a non-exempted user with no Stripe customer', async () => {
        userRepository.getUserById.mockResolvedValue(buildUser());
        (facade.stripe.customers.list as jest.Mock).mockResolvedValue({ data: [] });

        const status = await facade.hasUserPayed(1);

        expect(status.state).toBe(PaymentState.NONE);
        expect(status.active).toBe(false);
    });

    it('reports ACTIVE for a non-expired subscription without a pending cancellation', async () => {
        userRepository.getUserById.mockResolvedValue(buildUser());
        (facade.stripe.customers.list as jest.Mock).mockResolvedValue({ data: [{ id: 'cus_1' }] });
        (facade.stripe.subscriptions.list as jest.Mock).mockResolvedValue({ data: [buildStripeSubscription(3600, false)] });

        const status = await facade.hasUserPayed(1);

        expect(status.state).toBe(PaymentState.ACTIVE);
        expect(status.active).toBe(true);
    });

    it('reports CANCELED for a non-expired subscription with cancel_at_period_end set', async () => {
        userRepository.getUserById.mockResolvedValue(buildUser());
        (facade.stripe.customers.list as jest.Mock).mockResolvedValue({ data: [{ id: 'cus_1' }] });
        (facade.stripe.subscriptions.list as jest.Mock).mockResolvedValue({ data: [buildStripeSubscription(3600, true)] });

        const status = await facade.hasUserPayed(1);

        expect(status.state).toBe(PaymentState.CANCELED);
        expect(status.active).toBe(true);
    });

    it('reports EXPIRED for a non-exempted user whose subscription period has ended', async () => {
        userRepository.getUserById.mockResolvedValue(buildUser());
        (facade.stripe.customers.list as jest.Mock).mockResolvedValue({ data: [{ id: 'cus_1' }] });
        (facade.stripe.subscriptions.list as jest.Mock).mockResolvedValue({ data: [buildStripeSubscription(-3600, true)] });

        const status = await facade.hasUserPayed(1);

        expect(status.state).toBe(PaymentState.EXPIRED);
        expect(status.active).toBe(false);
    });
  });
});
