import { FlightConfig } from "../../shared/domain/custom-field";

export class UserConfig {
  preparation: {
    shvLinkDisabled: boolean;
    dabsLinkDisabled: boolean;
    links: string[];
  };
  notifications: {
    email: {
      appointment: boolean;
    };
  };
  flightConfig?: FlightConfig;
}