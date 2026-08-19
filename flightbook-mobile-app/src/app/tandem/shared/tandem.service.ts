import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
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

  defaultLimit = 20;

  constructor(private http: HttpClient) { }

  getPassengerConfirmations({ limit = null, offset = null }: { limit?: number, offset?: number } = {}): Observable<PassengerConfirmation[]> {
    let params: HttpParams = this.createPagingParams(limit, offset);
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

  /*
   * Compared against null rather than tested for truth: a caller asking for
   * offset 0 - the first page - means it, and `if (offset)` dropped the
   * parameter. There is no filter on this endpoint, so paging is all this does;
   * the flag it used to push into a filtered$ nobody subscribed to is gone.
   */
  private createPagingParams(limit: number | null, offset: number | null): HttpParams {
    let params = new HttpParams();

    if (limit != null) {
      params = params.append('limit', String(limit));
    }
    if (offset != null) {
      params = params.append('offset', String(offset));
    }

    return params;
  }
}
