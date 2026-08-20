import { FlightConfig } from "src/app/shared/domain/custom-field.model";

export class Link {
  url: string;
  label: string;
}

export class Preparation {
  dabsLinkDisabled?: boolean;
  links?: Link[];
}

export class notifications {
  email?: {
    appointment?: boolean;
  };
}

export class UserConfig {
  preparation?: Preparation;
  notifications?: notifications;
  flightConfig?: FlightConfig;
}