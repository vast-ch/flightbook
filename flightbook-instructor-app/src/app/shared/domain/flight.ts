import { Place } from './place'
import { Glider } from './glider'
import { FlightValidation } from './flight-validation';
import { TandemSchoolDataDto } from './tandem-school-data';

export class Flight {
    id: number | undefined;
    number: number | undefined;
    glider: Glider | undefined;
    date: string | undefined;
    start?: Place;
    landing?: Place;
    time?: string;
    km?: number;
    description?: string;
    price?: number;
    timestamp?: Date;
    shvAlone?: boolean;
    validation?: FlightValidation;
    tandemSchoolData?: TandemSchoolDataDto;
}
