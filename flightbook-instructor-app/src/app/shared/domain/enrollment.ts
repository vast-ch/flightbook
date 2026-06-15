import { EnrollmentType } from "./enrollmentType";
import { School } from "./school";

export class Enrollment {
    public email: string | undefined;
    public school: School | undefined;
    public token: string | undefined;
    public expireAt: Date | undefined;
    public type: EnrollmentType | undefined;
    public isUser: boolean | undefined;
}
