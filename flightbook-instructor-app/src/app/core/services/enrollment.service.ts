import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Enrollment } from 'src/app/shared/domain/enrollment';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EnrollmentService {

  constructor(private http: HttpClient) { }

  getEnrollmentByToken(token: string): Observable<Enrollment> {
    return this.http.get<Enrollment>(`${environment.baseUrl}/enrollments/${token}`);
  }

  acceptEnrollment(token: string) {
    return this.http.post<boolean>(`${environment.baseUrl}/enrollments/${token}`, null);
  }

  hasFreeEnrollment(schoolId: number, token: string) {
    return this.http.get<boolean>(`${environment.baseUrl}/student/schools/${schoolId}/enrollment/${token}/free`);
  }
}
