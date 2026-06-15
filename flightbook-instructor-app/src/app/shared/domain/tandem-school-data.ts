import { School } from "./school";
import { TandemSchoolPaymentState } from "./tandem-school-payment-state";
import { User } from "./user";

export interface CustomValue {
  key: string;
  value: any;
}

export class TandemSchoolDataDto {
  paymentState?: TandemSchoolPaymentState | undefined;
  paymentAmount?: number | undefined;
  paymentComment?: string | undefined;
  instructor?: User | undefined;
  tandemSchool?: School | undefined;
  schoolCustomValues?: CustomValue[] | undefined;
}
