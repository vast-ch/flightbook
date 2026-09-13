export class FlightStatistic {
    public type: string;
    public year: string;
    public month: string;
    /** 'daily' rows only. */
    public day: string;
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
    /** 'YYYY-MM-DD' of the flight behind bestDistance. */
    public bestDistanceDate: string;
    public paidFlights: number;
    /** Seconds. */
    public longestAirtime: number;
    /** 'YYYY-MM-DD' of the flight behind longestAirtime. */
    public longestAirtimeDate: string;
}
