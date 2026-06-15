import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable, Subject } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';
import { User } from '../../shared/domain/user';
import { environment } from 'src/environments/environment';
import { School } from 'src/app/shared/domain/school';
import { PaymentStatus } from 'src/app/shared/domain/payment-status';
import { Appointment } from 'src/app/shared/domain/appointment';
import moment from 'moment';
import { PagerEntity } from 'src/app/shared/domain/pagerEntity';

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private jwtHelper: JwtHelperService;
  changeSelectedSchool$: Subject<School> = new Subject<School>();
  currentSelectedSchool?: School;

  constructor(private http: HttpClient) {
    this.jwtHelper = new JwtHelperService();
  }

  setCurrentSchool(school: School) {
    this.currentSelectedSchool = school;
    this.changeSelectedSchool$.next(school);
  }

  refresh(refreshToken: string): Observable<any> {
    return this.http.post<any>(`${environment.baseUrl}/auth/refresh`, { "refresh_token": refreshToken });
  }

  login(loginData: any): Observable<any> {
    return this.http.post<any>(`${environment.baseUrl}/auth/login`, loginData);
  }

  register(user: User): Observable<any> {
    return this.http.post<any>(`${environment.baseUrl}/v2/users`, user);
  }

  logout(): Observable<any> {
    const refreshToken = localStorage.getItem('refresh_token');
    return this.http.post<any>(`${environment.baseUrl}/auth/logout`, { "refresh_token": refreshToken });
  }

  currentUser(): Observable<any> {
    return this.http.get<User>(`${environment.baseUrl}/users`);
  }

  updateUser(user: User): Observable<User> {
    return this.http.put<User>(`${environment.baseUrl}/users`, user);
  }

  updatePassword(pwd: any): Observable<User> {
    return this.http.put<any>(`${environment.baseUrl}/users/password/change`, pwd);
  }

  resetPassword(email: string): Observable<any> {
    return this.http.get<any>(`${environment.baseUrl}/auth/reset-password/${email}`);
  }

  getSchoolsByUserId(): Observable<School[]> {
    return this.http.get<School[]>(`${environment.baseUrl}/instructor/schools`);
  }

  getAppointmentsByUserId(from: Date, to: Date, state?: string, schoolId?: number): Observable<PagerEntity<Appointment[]>> {
    let params = new HttpParams();
    params = params.append('from', moment(from).format('YYYY-MM-DD'));
    params = params.append('to', moment(to).format('YYYY-MM-DD'));
    if (state !== undefined) {
      params = params.append('state', state);
    }
    if (schoolId !== undefined) {
      params = params.append('school_id', schoolId);
    }
    return this.http.get<PagerEntity<Appointment[]>>(`${environment.baseUrl}/instructor/appointments`, { params });
    }

  getStripeSession(enrollmentToken: string): Observable<any> {
    return this.http.get<any>(`${environment.baseUrl}/payments/stripe/session/${enrollmentToken}`);
  }

  getPaymentStatus(): Observable<PaymentStatus> {
    return this.http.get<PaymentStatus>(`${environment.baseUrl}/payments/status`);
  }

  async isAuth(): Promise<boolean> {
    let authenticated = false;
    const accessToken = localStorage.getItem('access_token');
    if (accessToken && this.jwtHelper.isTokenExpired(accessToken)) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const loginData = await firstValueFrom(this.refresh(refreshToken));
          if (loginData && loginData.access_token && loginData.refresh_token) {
            localStorage.setItem('access_token', loginData.access_token);
            localStorage.setItem('refresh_token', loginData.refresh_token);
            authenticated = true;
          } else {
            authenticated = false;
          }
        } catch (e) {
          authenticated = false;
        }
      } else {
        authenticated = false;
      }
    } else if (accessToken) {
      authenticated = true;
    }
    return authenticated;
  }
}
