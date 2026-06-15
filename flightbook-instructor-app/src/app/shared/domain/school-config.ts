export class GoogleCalendarConfig {
  accessToken?: string;
  refreshToken?: string;
  calendarId?: string;
  tokenExpiry?: Date;
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
}

export class SchoolConfig {
    schoolModule?: SchoolModule;
    tandemModule?: TandemModule;
    googleCalendar?: GoogleCalendarConfig;
}
