import { Flight } from "./flight";

export class User {
    id: number | undefined;
    firstname: string | undefined;
    lastname: string | undefined;
    email: string | undefined;
    password: string | undefined;
    phone: string | undefined;
    token: string | undefined;
    flights: Flight[] | undefined;
}
