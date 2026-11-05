import { PaymentFacade } from './payment-facade';
import { UserRepository } from '../user/user.repository';
import { HttpService } from '@nestjs/axios';
import { EmailService } from '../email/email.service';
import { User } from '../user/domain/user.entity';
import { PaymentState } from './paymentState';
import { UserEmailChangedEvent } from '../user/event/user-email-changed.event';
import { EnrollmentFacade } from '../training/enrollment/enrollment.facade';

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
      emailService: jest.Mocked<EmailService>,
      enrollmentFacade: jest.Mocked<EnrollmentFacade>;

  beforeEach(async () => {
    httpService = {} as any;
    userRepository = { getUserById: jest.fn() } as any;
    emailService = { sendErrorMessageToAdmin: jest.fn() } as any;
    enrollmentFacade = { isTrialEnabled: jest.fn().mockResolvedValue(false) } as any;
    facade = new PaymentFacade(httpService, userRepository, emailService, enrollmentFacade);
    facade.stripe = {
        customers: { list: jest.fn() },
        subscriptions: { list: jest.fn() },
        checkout: { sessions: { create: jest.fn().mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test' }) } },
    } as any;
  });

  it('should be defined', () => {
    expect(facade).toBeDefined();
  });

  describe('handleUserEmailChanged', () => {
    it('moves Stripe customers from the old email to the new one', async () => {
        (facade.stripe.customers.list as jest.Mock).mockResolvedValue({ data: [{ id: 'cus_1' }, { id: 'cus_2' }] });
        (facade.stripe.customers as any).update = jest.fn().mockResolvedValue({});

        await facade.handleUserEmailChanged(new UserEmailChangedEvent(buildUser({ email: 'new@example.com' }), 'old@example.com'));

        expect(facade.stripe.customers.list).toHaveBeenCalledWith({ email: 'old@example.com' });
        expect(facade.stripe.customers.update).toHaveBeenCalledWith('cus_1', { email: 'new@example.com' });
        expect(facade.stripe.customers.update).toHaveBeenCalledWith('cus_2', { email: 'new@example.com' });
    });
  });

  describe('getStripeSession', () => {
    const createdParams = () => (facade.stripe.checkout.sessions.create as jest.Mock).mock.calls[0][0];

    beforeEach(() => {
        process.env.STRIPE_PRICE = 'price_year';
        process.env.STRIPE_TRIAL_FEE_PRICE = 'price_fee';
        process.env.STRIPE_TRIAL_DAYS = '60';
        enrollmentFacade.isTrialEnabled.mockResolvedValue(true);
        userRepository.getUserById.mockResolvedValue(buildUser());
        (facade.stripe.customers.list as jest.Mock).mockResolvedValue({ data: [] });
        (facade.stripe.subscriptions.list as jest.Mock).mockResolvedValue({ data: [] });
    });

    it('adds the trial fee and trial period and disables promotion codes for a trial', async () => {
        await facade.getStripeSession(1, 'https://cb', 'de', 'token');

        const params = createdParams();
        expect(params.line_items).toEqual([{ price: 'price_year', quantity: 1 }, { price: 'price_fee', quantity: 1 }]);
        expect(params.subscription_data).toEqual({ trial_period_days: 60 });
        expect(params.allow_promotion_codes).toBe(false);
    });

    it('creates a plain session without a trial', async () => {
        await facade.getStripeSession(1, 'https://cb', 'de');

        const params = createdParams();
        expect(params.line_items).toEqual([{ price: 'price_year', quantity: 1 }]);
        expect(params.subscription_data).toBeUndefined();
        expect(params.allow_promotion_codes).toBe(true);
    });

    it('skips the trial for a customer who already had a subscription', async () => {
        (facade.stripe.customers.list as jest.Mock).mockResolvedValue({ data: [{ id: 'cus_1' }] });
        (facade.stripe.subscriptions.list as jest.Mock).mockResolvedValue({ data: [buildStripeSubscription(-3600, false)] });

        await facade.getStripeSession(1, 'https://cb', 'de', 'token');

        const params = createdParams();
        expect(facade.stripe.subscriptions.list).toHaveBeenCalledWith({ customer: 'cus_1', status: 'all', limit: 1 });
        expect(params.line_items).toEqual([{ price: 'price_year', quantity: 1 }]);
        expect(params.subscription_data).toBeUndefined();
        expect(params.allow_promotion_codes).toBe(true);
        expect(params.customer).toBe('cus_1');
    });

    it('keeps the trial for an existing customer without subscriptions', async () => {
        (facade.stripe.customers.list as jest.Mock).mockResolvedValue({ data: [{ id: 'cus_1' }] });

        await facade.getStripeSession(1, 'https://cb', 'de', 'token');

        expect(createdParams().subscription_data).toEqual({ trial_period_days: 60 });
    });
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
