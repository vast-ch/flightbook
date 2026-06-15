import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Student } from 'src/app/shared/domain/student';
import { Enrollment } from 'src/app/shared/domain/enrollment';
import { environment } from 'src/environments/environment';
import { Appointment } from 'src/app/shared/domain/appointment';
import { Subscription } from 'src/app/shared/domain/subscription';
import { PagerEntity } from 'src/app/shared/domain/pagerEntity';
import { AppointmentFilter } from 'src/app/shared/domain/appointment-filter';
import moment from 'moment';
import { TeamMember } from 'src/app/shared/domain/team-member';
import { School } from 'src/app/shared/domain/school';
import { AppointmentType } from 'src/app/shared/domain/appointment-type-dto';
import { TandemPilot } from 'src/app/shared/domain/tandem-pilot';
import { PassengerConfirmation } from 'src/app/shared/domain/passenger-confirmation';
import { Flight } from 'src/app/shared/domain/flight';
import { SchoolConfig } from 'src/app/shared/domain/school-config';

@Injectable({
  providedIn: 'root'
})
export class SchoolService {

  filter: AppointmentFilter;
  limit = 10;

  constructor(private http: HttpClient) {
    this.filter = new AppointmentFilter();
  }

  createSchool(school: School): Observable<School> {
    return this.http.post<School>(`${environment.baseUrl}/schools`, school);
  }

  updateSchoolConfiguration(id: number, configuration: SchoolConfig): Observable<School> {
    return this.http.put<School>(`${environment.baseUrl}/schools/${id}/configuration`, configuration);
  }

  getGoogleCalendarStatus(id: number): Observable<{ connected: boolean }> {
    return this.http.get<{ connected: boolean }>(`${environment.baseUrl}/schools/${id}/google-calendar/status`);
  }

  getGoogleCalendarAuthUrl(id: number): Observable<{ authUrl: string }> {
    return this.http.get<{ authUrl: string }>(`${environment.baseUrl}/schools/${id}/google-calendar/auth`);
  }

  disconnectGoogleCalendar(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.baseUrl}/schools/${id}/google-calendar/disconnect`);
  }

  getAvailableCalendars(id: number): Observable<Array<{ id: string; summary: string; primary: boolean }>> {
    return this.http.get<Array<{ id: string; summary: string; primary: boolean }>>(`${environment.baseUrl}/schools/${id}/google-calendar/calendars`);
  }

  updateGoogleCalendar(id: number, calendarId: string): Observable<void> {
    return this.http.put<void>(`${environment.baseUrl}/schools/${id}/google-calendar/calendar`, { calendarId });
  }

  getStudentsBySchoolId(id: number, archived: boolean): Observable<Student[]> {
    let params = new HttpParams();
    if (archived !== undefined) {
      params = params.append('archived', archived);
    }
    return this.http.get<Student[]>(`${environment.baseUrl}/instructor/schools/${id}/students`, { params });
  }
  getArchivedStudentsBySchoolId(id: number): Observable<Student[]> {
    return this.http.get<Student[]>(`${environment.baseUrl}/instructor/schools/${id}/students/archived`);
  }

  getTeamMembers(id: number): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>(`${environment.baseUrl}/instructor/schools/${id}/team-members`);
  }

  postStudentsEnrollment(id: number, email: string) {
    return this.http.post<Enrollment>(`${environment.baseUrl}/instructor/schools/${id}/students/enrollment`, { email: email });
  }

  postTeamMemberEnrollment(id: number, email: string) {
    return this.http.post<Enrollment>(`${environment.baseUrl}/instructor/schools/${id}/team-members/enrollment`, { email: email });
  }

  deleteTeamMember(id: number, teamMember: TeamMember) {
    return this.http.delete<TeamMember>(`${environment.baseUrl}/instructor/schools/${id}/team-members/${teamMember.id}`);
  }

  getAppointmentsBySchoolId({ limit = undefined, offset = undefined}: { limit?: number, offset?: number} = {}, id: number): Observable<PagerEntity<Appointment[]>> {
    let params: HttpParams = this.createFilterParams(limit, offset);
    return this.http.get<PagerEntity<Appointment[]>>(`${environment.baseUrl}/instructor/schools/${id}/appointments`, { params });
  }

  postAppointment(id: number, appointment: Appointment): Observable<Appointment> {
    return this.http.post<Appointment>(`${environment.baseUrl}/instructor/schools/${id}/appointments`, appointment);
  }

  putAppointment(id: number, appointment: Appointment): Observable<Appointment> {
    return this.http.put<Appointment>(`${environment.baseUrl}/instructor/schools/${id}/appointments/${appointment.id}`, appointment);
  }

  getAppointmentSubscriptions(id: number, appointmentId: number): Observable<Subscription[]> {
    return this.http.get<Subscription[]>(`${environment.baseUrl}/instructor/schools/${id}/appointments/${appointmentId}/subscriptions`);
  }

  getSubscriptionStudentDetail(id: number, appointmentId: number): Observable<Student[]> {
    return this.http.get<Student[]>(`${environment.baseUrl}/instructor/schools/${id}/appointments/${appointmentId}/students`);
  }

  getAppointmentTypesBySchoolId(id: number, { limit = undefined, offset = undefined, archived = undefined}: { limit?: number, offset?: number, archived?: boolean} = {}): Observable<AppointmentType[]> {
    let params = new HttpParams();
    if(archived!=undefined) {
      params = params.append('archived', archived);
    }
    if (limit) {
      params = params.append('limit', limit.toString());
    }
    if (offset) {
      params = params.append('offset', offset.toString());
    }
    return this.http.get<AppointmentType[]>(`${environment.baseUrl}/instructor/schools/${id}/appointment-types`, {params});
  }

  postAppointmentType(id: number, appointmentType: AppointmentType): Observable<AppointmentType> {
    return this.http.post<AppointmentType>(`${environment.baseUrl}/instructor/schools/${id}/appointment-types`, appointmentType);
  }

  putAppointmentType(id: number, appointmentType: AppointmentType): Observable<AppointmentType> {
    return this.http.put<AppointmentType>(`${environment.baseUrl}/instructor/schools/${id}/appointment-types/${appointmentType.id}`, appointmentType);
  }

  // Tandem pilot requests
  postTandemPilotEnrollment(id: number, email: string) {
    return this.http.post<Enrollment>(`${environment.baseUrl}/schools/${id}/tandem-pilots/enrollment`, { email: email });
  }

  getTandemPilotsBySchoolId(id: number, archived: boolean): Observable<TandemPilot[]> {
    let params = new HttpParams();
    if (archived !== undefined) {
      params = params.append('archived', archived);
    }
    return this.http.get<TandemPilot[]>(`${environment.baseUrl}/schools/${id}/tandem-pilots`, { params });
  }

  getPassengerConfirmationsBySchoolIdAndTandemPilotId({ limit = undefined, offset = undefined}: { limit?: number, offset?: number} = {}, id: number, tandemPilotId: number): Observable<PagerEntity<PassengerConfirmation[]>> {
    let params: HttpParams = this.createFilterParams(limit, offset);
    return this.http.get<PagerEntity<PassengerConfirmation[]>>(`${environment.baseUrl}/schools/${id}/tandem-pilots/${tandemPilotId}/passenger-confirmations`, { params });
  }

  getTandemPilotFlightsBySchoolIdAndTandemPilotId({ limit = undefined, offset = undefined}: { limit?: number, offset?: number} = {}, id: number, tandemPilotId: number): Observable<PagerEntity<Flight[]>> {
    let params: HttpParams = this.createFilterParams(limit, offset);
    return this.http.get<PagerEntity<Flight[]>>(`${environment.baseUrl}/schools/${id}/tandem-pilots/${tandemPilotId}/flights`, { params });
  }

  archiveTandemPilot(id: number, tandemPilot: TandemPilot) {
    return this.http.delete<TandemPilot>(`${environment.baseUrl}/schools/${id}/tandem-pilots/${tandemPilot.id}`);
  }
  validateTandemPilotFlightSchoolIdAndStudentId(id: number, tandemPilot: TandemPilot, flight: Flight): Observable<Flight> {
    return this.http.put<Flight>(`${environment.baseUrl}/schools/${id}/tandem-pilots/${tandemPilot.id}/flights/${flight.id}`, flight.tandemSchoolData);
  }

  getAllTandemPilotFlights(schoolId: number, tandemPilotId: number): Observable<PagerEntity<Flight[]>> {
    return this.http.get<PagerEntity<Flight[]>>(`${environment.baseUrl}/schools/${schoolId}/tandem-pilots/${tandemPilotId}/flights`);
  }

  getAllPassengerConfirmations(schoolId: number, tandemPilotId: number): Observable<PagerEntity<PassengerConfirmation[]>> {
    return this.http.get<PagerEntity<PassengerConfirmation[]>>(`${environment.baseUrl}/schools/${schoolId}/tandem-pilots/${tandemPilotId}/passenger-confirmations`);
  }

  private createFilterParams(limit: Number | undefined, offset: Number | undefined): HttpParams {
    let params = new HttpParams();
    if (this.filter.from && this.filter.from !== null) {
      params = params.append('from', moment(this.filter.from).format('YYYY-MM-DD'));
    }
    if (this.filter.to && this.filter.to !== null) {
      params = params.append('to', moment(this.filter.to).format('YYYY-MM-DD'));
    }
    if (this.filter.state) {
      params = params.append('state', this.filter.state);
    }

    if (this.filter.instructorId) {
      params = params.append('instructorId', this.filter.instructorId?.toString() || '');
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
