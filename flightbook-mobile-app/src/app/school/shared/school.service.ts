import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import moment from 'moment';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
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

  filter: AppointmentFilter;
  filtered$: BehaviorSubject<boolean>;
  defaultLimit = 20;
  schoolsSignal = signal<School[] | null>(null);

  constructor(private http: HttpClient) {
    this.filter = new AppointmentFilter();
    this.filtered$ = new BehaviorSubject(false);
  }

  async getSchools(): Promise<School[]> {
    if (!this.schoolsSignal()) {
      const schools = await firstValueFrom(this.http.get<School[]>(`${environment.baseUrl}/student/schools`));
      this.schoolsSignal.set(schools);
    }
    return this.schoolsSignal()!;
  }

  clearSchools() {
    this.schoolsSignal.set(null);
  }

  getAppointments({ limit = null, offset = null}: { limit?: number, offset?: number} = {}, schoolId: number, scope?: AppointmentScope ): Observable<Appointment[]> {
    let params: HttpParams = this.createFilterParams(limit, offset);
    params = this.appendScope(params, scope);

    return this.http.get<Appointment[]>(`${environment.baseUrl}/student/schools/${schoolId}/appointments`, { params });
  }

  /**
   * The Upcoming / Past tabs, expressed with the from/to params the endpoint
   * already takes. A bound the user set in the filter wins - their filter is the
   * more specific request - and the scope deliberately does not touch filtered$,
   * or every plain list would claim to be filtered.
   *
   * Note both bounds are date-only, so today satisfies either scope; the page
   * settles today's appointments against the clock.
   */
  private appendScope(params: HttpParams, scope?: AppointmentScope): HttpParams {
    if (!scope) {
      return params;
    }
    const today = moment().format('YYYY-MM-DD');
    if (scope === 'upcoming' && !this.filter.from) {
      return params.append('from', today);
    }
    if (scope === 'past' && !this.filter.to) {
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

  private setFilterState(nextState: boolean) {
    this.filtered$.next(nextState);
  }

  private createFilterParams(limit: Number, offset: Number): HttpParams {
    let params = new HttpParams();
    let filterState = false;
    if (this.filter.from && this.filter.from !== null) {
      params = params.append('from', moment(this.filter.from).format('YYYY-MM-DD'));
      filterState = true;
    }
    if (this.filter.to && this.filter.to !== null) {
      params = params.append('to', moment(this.filter.to).format('YYYY-MM-DD'));
      filterState = true;
    }
    if (this.filter.state) {
      params = params.append('state', this.filter.state);
      filterState = true
    }

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
