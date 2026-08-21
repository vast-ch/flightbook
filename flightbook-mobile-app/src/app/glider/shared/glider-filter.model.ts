export class GliderFilter {
    brand: string;
    name: string;
    type: string;
    archived: string;

    constructor() {
        // "" not undefined: the manufacturer is a select now, and its "all"
        // option carries "" - an undefined value matches no option and would
        // render the control blank rather than "All".
        this.brand = "";
        this.name = "";
        this.type = "";
        this.archived = "";
    }
}
