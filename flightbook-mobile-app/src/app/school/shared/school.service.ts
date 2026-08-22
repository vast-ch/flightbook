import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import moment from 'moment';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AppointmentFilter } from './appointment-filter.model';
import { Appointment } from './appointment.model';
import { School } from './school.model';
import { ControlSheet } from 'src/app/shared/domain/control-sheet';
import { EmergencyContact } from './emergency-contact.model';

/** Which side of today an appointment list asks for. */
export type AppointmentScope = 'upcoming' | 'past';

@Injectable({
  providedIn: 'root'
})
export class SchoolService {

  /**
   * A signal, as the flight and glider filters are: the list draws a removable
   * chip per criterion, and a plain object cannot tell those chips that one was
   * dropped - `filtered` stays true while others remain, so nothing recomputes.
   */
  filter = signal<AppointmentFilter>(new AppointmentFilter());

  /**
   * Derived, not set when a request is built: the flag drove the list's header
   * badge and its active filter button, so a filter changed without a fetch -
   * a chip cleared, Clear then the same state picked again in the sheet - left
   * both asserting the opposite of what the chips row showed. FlightStore
   * derives its own for the same reason.
   */
  filtered = computed(() => {
    const { from, to, state } = this.filter();
    return !!from || !!to || !!state;
  });

  defaultLimit = 20;
  schoolsSignal = signal<School[] | null>(null);

  constructor(private http: HttpClient) { }

  /** Patches the shared filter in place, the way FlightStore.updateFilter does. */
  updateFilter(patch: Partial<AppointmentFilter>): void {
    this.filter.update(current => Object.assign(new AppointmentFilter(), current, patch));
  }

  /**
   * The in-flight promise is memoised, not just the resolved value: HomeStore
   * asks twice in the same tick, and caching only the result let both callers
   * miss the cache and fire their own request.
   */
  private schoolsRequest?: Promise<School[]>;

  async getSchools(): Promise<School[]> {
    const cached = this.schoolsSignal();
    if (cached) {
      return cached;
    }
    if (!this.schoolsRequest) {
      this.schoolsRequest = firstValueFrom(this.http.get<School[]>(`${environment.baseUrl}/student/schools`))
        .then(schools => {
          this.schoolsSignal.set(schools);
          return schools;
        })
        .finally(() => { this.schoolsRequest = undefined; });
    }
    return this.schoolsRequest;
  }

  clearSchools() {
    this.schoolsSignal.set(null);
    this.schoolsRequest = undefined;
  }

  /**
   * The appointment filter is shared by every school screen and outlives the
   * page that set it, so it has to go with the session too - the flight filter
   * already does. Left set, the next account opened its appointment list
   * silently narrowed by a date range and a state it never chose.
   */
  resetFilter() {
    this.filter.set(new AppointmentFilter());
  }

  /**
   * @param applyFilter pass false to ignore the shared appointment filter - the
   * dashboard's next-appointment card has no filter control of its own, so it
   * must not silently inherit whatever the appointment list was last narrowed by.
   */
  getAppointments({ limit = null, offset = null, applyFilter = true }:
    { limit?: number, offset?: number, applyFilter?: boolean } = {}, schoolId: number, scope?: AppointmentScope ): Observable<Appointment[]> {
    let params: HttpParams = applyFilter ? this.createFilterParams(limit, offset) : this.createPagingParams(limit, offset);
    params = this.appendScope(params, scope, applyFilter);

    return this.http.get<Appointment[]>(`${environment.baseUrl}/student/schools/${schoolId}/appointments`, { params });
  }

  /**
   * The Upcoming / Past tabs, expressed with the from/to params the endpoint
   * already takes. A bound the user set in the filter wins - their filter is the
   * more specific request - and the scope is not part of `filtered`, or every
   * plain list would claim to be filtered.
   *
   * Note both bounds are date-only, so today satisfies either scope; the page
   * settles today's appointments against the clock.
   */
  private appendScope(params: HttpParams, scope: AppointmentScope | undefined, applyFilter: boolean): HttpParams {
    if (!scope) {
      return params;
    }
    // A bound the user set wins - unless the caller opted out of the filter, in
    // which case there is no user bound to defer to. Read only on that path, so
    // an applyFilter: false caller takes no dependency on the shared filter.
    const filter = applyFilter ? this.filter() : null;
    const today = moment().format('YYYY-MM-DD');
    if (scope === 'upcoming' && !filter?.from) {
      return params.append('from', today);
    }
    if (scope === 'past' && !filter?.to) {
      return params.append('to', today);
    }
    return params;
  }

  getAppointment(schoolId: number, appointmentId: number ): Observable<Appointment> {
    return this.http.get<Appointment>(`${environment.baseUrl}/student/schools/${schoolId}/appointments/${appointmentId}`);
  }

  subscribeToAppointment(schoolId: number, appointmentId: number): Observable<Appointment> {
    return this.http.post<Appointment>(`${environment.baseUrl}/student/schools/${schoolId}/appointments/${appointmentId}/subscriptions`, {});
  }

  deleteAppointmentSubscription(schoolId: number, appointmentId: number): Observable<Appointment> {
    return this.http.delete<Appointment>(`${environment.baseUrl}/student/schools/${schoolId}/appointments/${appointmentId}/subscriptions`);
  }

  getControlSheet(): Observable<ControlSheet> {
    return this.http.get<ControlSheet>(`${environment.baseUrl}/student/control-sheet`);
  }

  postControlSheet(controlSheet: ControlSheet): Observable<ControlSheet> {
    return this.http.post<ControlSheet>(`${environment.baseUrl}/student/control-sheet`, controlSheet);
  }

  getEmergencyContacts(): Observable<EmergencyContact[]> {
    return this.http.get<EmergencyContact[]>(`${environment.baseUrl}/student/emergency-contacts`);
  }

  postEmergencyContact(emergencyContact: EmergencyContact): Observable<EmergencyContact> {
    return this.http.post<EmergencyContact>(`${environment.baseUrl}/student/emergency-contacts`, emergencyContact);
  }

  leaveSchool(schoolId: number): Observable<void> {
    return this.http.delete<void>(`${environment.baseUrl}/student/schools/${schoolId}`);
  }

  removeSchoolFromStore(schoolId: number): void {
    const currentSchools = this.schoolsSignal();
    if (currentSchools) {
      this.schoolsSignal.set(currentSchools.filter(school => school.id !== schoolId));
    }
  }

  /** Paging only - no filter read. */
  private createPagingParams(limit: Number, offset: Number): HttpParams {
    let params = new HttpParams();
    if (limit) {
      params = params.append('limit', limit.toString());
    }
    if (offset) {
      params = params.append('offset', offset.toString());
    }
    return params;
  }

  private createFilterParams(limit: Number, offset: Number): HttpParams {
    let params = new HttpParams();
    const filter = this.filter();
    if (filter.from) {
      params = params.append('from', moment(filter.from).format('YYYY-MM-DD'));
    }
    if (filter.to) {
      params = params.append('to', moment(filter.to).format('YYYY-MM-DD'));
    }
    if (filter.state) {
      params = params.append('state', filter.state);
    }

    if (limit) {
      params = params.append('limit', limit.toString());
    }
    if (offset) {
      params = params.append('offset', offset.toString());
    }

    return params;
  }
}
