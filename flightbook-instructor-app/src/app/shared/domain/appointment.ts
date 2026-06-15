import { AppointmentType } from "./appointment-type-dto";
import { GuestSubscription } from "./guest-subscription";
import { School } from "./school";
import { State } from "./state";
import { Subscription } from "./subscription";
import { User } from "./user";

export class Appointment {
    id: number | undefined;
    type: AppointmentType | undefined;
    scheduling: Date | undefined;
    deadline: Date | undefined;
    meetingPoint: string | undefined;
    maxPeople: number | undefined;
    description: string | undefined;
    state: State | undefined;
    school: School | undefined;
    instructor: User | undefined;
    takeOffCoordinator: User | undefined;
    takeOffCoordinatorText: string | undefined;
    subscriptions: Subscription[] = [];
    guestSubscriptions: GuestSubscription[] = [];
    countSubscription: number | undefined;
    countGuestSubscription: number | undefined;
    countWaitingList: number | undefined;
}
