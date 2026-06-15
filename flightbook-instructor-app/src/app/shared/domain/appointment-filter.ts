import { State } from "./state";

export class AppointmentFilter {
    from: Date | undefined;
    to: Date | undefined;
    state: State | undefined;
    instructorId: number | undefined;

    constructor() {}
}
