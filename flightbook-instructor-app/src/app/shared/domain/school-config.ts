export class GoogleCalendarConfig {
  calendarId?: string;
}

export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'dropdown';
  required: boolean;
  disabled: boolean;
  options?: string[];
}

export interface FlightConfig {
  customFields: CustomFieldDefinition[];
}

export class TandemModule {
  active?: boolean;
  termsAndConditionsLink?: string;
  flightConfig?: FlightConfig;
}

export class SchoolModule {
  active?: boolean;
  validateFlights?: boolean;
  userCanEditControlSheet?: boolean;
  commentsOnSubscription?: boolean;
  trialEnabled?: boolean;
}

/** Values are the instructor app's route paths. */
export type StartPage = 'students' | 'appointments' | 'tandem-pilots';

export class SchoolConfig {
    schoolModule?: SchoolModule;
    tandemModule?: TandemModule;
    googleCalendar?: GoogleCalendarConfig;
    startPage?: StartPage;
}

/** Start pages a school may choose, given which modules it has active. */
export function availableStartPages(config?: SchoolConfig): StartPage[] {
  const pages: StartPage[] = [];
  if (config?.schoolModule?.active) {
    pages.push('students', 'appointments');
  }
  if (config?.tandemModule?.active) {
    pages.push('tandem-pilots');
  }
  return pages;
}

/** The configured start page if it is still allowed, else the first allowed one, else students. */
export function resolveStartPage(config?: SchoolConfig): StartPage {
  const pages = availableStartPages(config);
  if (config?.startPage && pages.includes(config.startPage)) {
    return config.startPage;
  }
  return pages[0] ?? 'students';
}
