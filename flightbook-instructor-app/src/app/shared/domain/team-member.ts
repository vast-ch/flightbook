import { User } from "./user";

export class TeamMember {
    public id?: number;
    public user: User;
    public admin?: boolean;

    constructor() {
        this.user = new User();
    }
}
