import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PassengerConfirmation } from './domain/passenger-confirmation.model';

/**
 * `date` is a calendar day, but this endpoint serialises it as UTC midnight
 * ("2024-01-01T00:00:00.000Z"), and a DatePipe renders that instant in the
 * device's zone - a day early for everyone west of UTC. Flights already arrive
 * as "2024-01-01", so normalising on the way in leaves every consumer - the
 * list, its month headings, the detail sheet, the export - one shape to read.
 *
 * The day is recoverable from the string because the API declares @Type(() =>
 * Date) over a `date` column: the instant is always UTC midnight, whatever zone
 * the API host runs in. Should that DTO ever send a real instant instead, this
 * has to parse rather than cut - and the day the DTO strips the time itself,
 * the guard below makes this a no-op.
 *
 * The cast is the model's fault, not this function's: `date` is declared
 * `Date` while JSON only ever delivers a string.
 */
function toCalendarDay(confirmation: PassengerConfirmation): PassengerConfirmation {
  const date = confirmation.date as unknown;
  if (typeof date !== 'string' || !date.includes('T')) {
    return confirmation;
  }
  return { ...confirmation, date: date.substring(0, 10) as unknown as Date };
}

@Injectable({
  providedIn: 'root'
})
export class TandemService {

  // filter: AppointmentFilter;
  filtered$: BehaviorSubject<boolean>;
  defaultLimit = 20;

  constructor(private http: HttpClient) {
    this.filtered$ = new BehaviorSubject(false);
  }

  getPassengerConfirmations({ limit = null, offset = null }: { limit?: number, offset?: number } = {}): Observable<PassengerConfirmation[]> {
    let params: HttpParams = this.createFilterParams(limit, offset);
    return this.http.get<PassengerConfirmation[]>(`${environment.baseUrl}/passenger-confirmations`, { params })
      .pipe(map(confirmations => confirmations.map(toCalendarDay)));
  }

  postPassengerConfirmations(passengerConfirmation: PassengerConfirmation): Observable<PassengerConfirmation> {
    return this.http.post<PassengerConfirmation>(`${environment.baseUrl}/passenger-confirmations`, passengerConfirmation);
  }

  deletePassengerConfirmation(passengerConfirmationId: number): Observable<void> {
    return this.http.delete<void>(`${environment.baseUrl}/passenger-confirmations/${passengerConfirmationId}`);
  }

  private setFilterState(nextState: boolean) {
    this.filtered$.next(nextState);
  }

  private createFilterParams(limit: Number, offset: Number): HttpParams {
    let params = new HttpParams();
    let filterState = false;

    if (limit) {
      params = params.append('limit', limit.toString());
    }
    if (offset) {
      params = params.append('offset', offset.toString());
    }

    this.setFilterState(filterState);
    return params;
  }
}
