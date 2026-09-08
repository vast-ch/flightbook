import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AccountService } from '../core/services/account.service';
import { School } from '../shared/domain/school';
import { User } from '../shared/domain/user';
import { MatDialog } from '@angular/material/dialog';
import { PasswordComponent } from '../account/password/password.component';
import { InstructorExportComponent } from './component/instructor-export/instructor-export.component';

@Component({
    selector: 'app-main',
    templateUrl: './main.component.html',
    styleUrls: ['./main.component.scss'],
    standalone: false
})
export class MainComponent implements OnInit {

  unsubscribe$ = new Subject<void>();
  schools: School[] | undefined;
  selectedSchool: School | undefined;
  currentUser: User | undefined;

  constructor(
    private accountService: AccountService,
    private router: Router,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.accountService.getSchoolsByUserId().pipe(takeUntil(this.unsubscribe$)).subscribe((schools: School[]) => {
      this.schools = schools;
      if (this.schools.length == 0){
        this.router.navigate(['no-school']);
      }
      this.selectedSchool = schools[0];
      this.accountService.setCurrentSchool(this.selectedSchool);
    })

    const cachedUser = this.accountService.currentUser$();
    if (cachedUser) {
      this.currentUser = cachedUser;
    } else {
      this.accountService.currentUser().pipe(takeUntil(this.unsubscribe$)).subscribe((user: User) => {
        this.currentUser = user;
      });
    }
  }

  get accountInitials(): string {
    const first = this.currentUser?.firstname?.charAt(0) ?? '';
    const last = this.currentUser?.lastname?.charAt(0) ?? '';
    return (first + last).toUpperCase();
  }

  openPasswordDialog(): void {
    const dialogRef = this.dialog.open(PasswordComponent, {
      width: '700px'
    });
  }

  openExportDialog(): void {
    const dialogRef = this.dialog.open(InstructorExportComponent, {
      width: '700px',
      data: { schools: this.schools }
    });
  }

  logout() {
    this.accountService.logout().pipe(takeUntil(this.unsubscribe$)).subscribe(resp => {
      // TODO error handling
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      this.router.navigate(['login']);
    });
  }

  switchSchool(school: School) {
    this.selectedSchool = school;
    this.accountService.setCurrentSchool(this.selectedSchool);
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

}
