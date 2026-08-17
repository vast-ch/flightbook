export class FlightStatistic {
    public type: string;
    public year: string;
    public month: string;
    public nbFlights: number;
    /** Flights flown solo under SHV/SHGPA rules. Returned by the API already. */
    public nbFlightsAlone: number;
    public time: number;
    public income: number;
    public average: number;
    public nbStartplaces: number;
    public nbLandingplaces: number;
    public totalDistance: number;
    public bestDistance: number;
}
