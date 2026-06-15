import { Student } from "./student";
import { User } from "./user";

export class Subscription {
    id: number | undefined;
    user: User | undefined;
    student: Student | undefined;
    waitingList: boolean | undefined;
}
