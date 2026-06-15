import { School } from './school';

export class PassengerConfirmation {
    id: number | undefined;
    date: string | undefined;
    firstname: string | undefined;
    lastname: string | undefined;
    email: string | undefined;
    phone: string | undefined;
    place: string | undefined;
    signature: string | undefined;
    signatureMimeType: string | undefined;
    canUseData: boolean | undefined;
    tandemSchool: School | undefined;
}
