import { User } from "./user";

export class AppointmentType {
    id?: number;
    name?: string;
    archived?: boolean;
    meetingPoint?: string;
    maxPeople?: number;
    color?: string;
    instructor?: User
    time?: string;
    deadlineOffsetHours?: number;
}