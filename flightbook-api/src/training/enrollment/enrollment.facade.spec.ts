import { EnrollmentFacade } from './enrollment.facade';
import { UserRepository } from '../../user/user.repository';
import { SchoolRepository } from '../school/school.repository';
import { EnrollmentRepository } from './enrollment.repository';
import { StudentRepository } from '../student/student.repository';
import { TeamMemberRepository } from '../team-member/team-member.repository';
import { EmailService } from '../../email/email.service';
import { TandemPilotRepository } from '../tandem-pilot/tandem-pilot.repository';
import { EnrollmentType } from './enrollment-type';
import { ControlSheetRepository } from '../control-sheet/control-sheet.repository';

describe('EnrollmentFacade', () => {
  let facade: EnrollmentFacade,
      userRepository: jest.Mocked<UserRepository>,
      schoolRepository: jest.Mocked<SchoolRepository>,
      enrollmentRepository: jest.Mocked<EnrollmentRepository>,
      studentRepository: jest.Mocked<StudentRepository>,
      teamMemberRepository: jest.Mocked<TeamMemberRepository>,
      tandemPilotRepository: jest.Mocked<TandemPilotRepository>,
      emailService: jest.Mocked<EmailService>,
      controlSheetRepository: jest.Mocked<ControlSheetRepository>;

  beforeAll(async () => {
    enrollmentRepository = {} as any;
    userRepository = {} as any;
    studentRepository = {} as any;
    teamMemberRepository = {} as any;
    tandemPilotRepository = {} as any;
    schoolRepository = {} as any;
    emailService = {} as any;
    controlSheetRepository = {} as any;
    facade = new EnrollmentFacade(enrollmentRepository, userRepository, studentRepository, teamMemberRepository, tandemPilotRepository, schoolRepository, emailService, controlSheetRepository);
  });

  it('should be defined', () => {
    expect(facade).toBeDefined();
  });

  describe('isTrialEnabled', () => {
    const enrollmentWith = (schoolModule: any, type = EnrollmentType.STUDENT) =>
      ({ type, school: { configuration: { schoolModule } } }) as any;

    beforeEach(() => {
      enrollmentRepository.getEnrollmentByToken = jest.fn();
    });

    it('is true when the school has trialEnabled', async () => {
      enrollmentRepository.getEnrollmentByToken.mockResolvedValue(enrollmentWith({ trialEnabled: true }));
      expect(await facade.isTrialEnabled('token')).toBe(true);
    });

    it('is false when trialEnabled is false or missing', async () => {
      enrollmentRepository.getEnrollmentByToken.mockResolvedValue(enrollmentWith({ trialEnabled: false }));
      expect(await facade.isTrialEnabled('token')).toBe(false);
      enrollmentRepository.getEnrollmentByToken.mockResolvedValue(enrollmentWith({}));
      expect(await facade.isTrialEnabled('token')).toBe(false);
    });

    it('is false for a tandem pilot enrollment even when the school has trialEnabled', async () => {
      enrollmentRepository.getEnrollmentByToken.mockResolvedValue(enrollmentWith({ trialEnabled: true }, EnrollmentType.TANDEM_PILOT));
      expect(await facade.isTrialEnabled('token')).toBe(false);
    });

    it('is false when the enrollment or school config is missing', async () => {
      enrollmentRepository.getEnrollmentByToken.mockResolvedValue(undefined);
      expect(await facade.isTrialEnabled('token')).toBe(false);
      enrollmentRepository.getEnrollmentByToken.mockResolvedValue({ type: EnrollmentType.STUDENT, school: { configuration: null } } as any);
      expect(await facade.isTrialEnabled('token')).toBe(false);
    });
  });
});
