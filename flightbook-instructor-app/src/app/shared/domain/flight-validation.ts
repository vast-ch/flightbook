import { User } from "./user";
import { School } from "./school";
import { FlightValidationState } from "./flight-validation-state";

export class FlightValidation {
  state?: FlightValidationState | undefined;
  comment?: string | undefined;
  instructor?: User | undefined;
  school?: School | undefined;
  timestamp?: Date | undefined;
}
