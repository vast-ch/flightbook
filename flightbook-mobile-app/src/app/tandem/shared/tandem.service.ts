import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PassengerConfirmation } from './domain/passenger-confirmation.model';
import { localDate } from 'src/app/shared/util/format';

/**
 * `date` is a calendar day, but this endpoint serialises it as UTC midnight
 * ("2024-01-01T00:00:00.000Z"), and a DatePipe renders that instant in the
 * device's zone - a day early for everyone west of UTC. Flights already arrive
 * as "2024-01-01", so reading the day once, here, leaves every consumer - the
 * list, its month headings, the detail sheet, the export - one thing to read.
 *
 * localDate does the reading, the same helper the month headings use, and it
 * returns a real Date - which is what the model has always claimed this field
 * is. That is what retires the cast this function used to need.
 */
function toCalendarDay(confirmation: PassengerConfirmation): PassengerConfirmation {
  return { ...confirmation, date: localDate(confirmation.date) };
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
    return this.http.post<PassengerConfirmation>(`${environment.baseUrl}/passenger-confirmations`, passengerConfirmation)
      .pipe(map(toCalendarDay));
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
