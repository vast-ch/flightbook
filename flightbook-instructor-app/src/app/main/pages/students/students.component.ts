import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren, effect } from '@angular/core';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AccountService } from 'src/app/core/services/account.service';
import { SchoolService } from 'src/app/core/services/school.service';
import { School } from 'src/app/shared/domain/school';
import { Student } from 'src/app/shared/domain/student';

import { MatDialog } from '@angular/material/dialog';
import { EmailDialogComponent } from '../../component/email-dialog/email-dialog.component';
import { TranslateService } from '@ngx-translate/core';
import { DeviceSizeService } from 'src/app/core/services/device-size.service';
import { MatSidenav } from '@angular/material/sidenav';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'fb-students',
    templateUrl: './students.component.html',
    styleUrls: ['./students.component.scss'],
    standalone: false
})
export class StudentsComponent implements OnInit, OnDestroy {
  school: School | undefined;
  selectedStudent: Student | undefined;
  studentList: Student[];
  @ViewChild(MatSidenav) sidenav: MatSidenav | undefined;
  @ViewChildren('tabButton') tabButtons: QueryList<ElementRef<HTMLButtonElement>> | undefined;
  unsubscribe$ = new Subject<void>();

  students: Student[];
  archivedStudents: Student[];
  sortBy: string = 'firstname';
  selectedTabIndex = 0;

  constructor(
    private translate: TranslateService,
    private schoolService: SchoolService,
    private accountService: AccountService,
    private snackBar: MatSnackBar,
    public dialog: MatDialog,
    private deviceSize: DeviceSizeService
  ) {
    this.studentList = [];
    this.students = [];
    this.archivedStudents = [];

    effect(() => {
      if (!this.deviceSize.isMobile()) {
        this.sidenav?.open();
      }
    });
  }

  ngOnInit(): void {
    this.school = this.accountService.currentSelectedSchool;
    if (this.school) {
      this.syncStudentList(false);
    }
    this.accountService.changeSelectedSchool$.pipe(takeUntil(this.unsubscribe$)).subscribe((school: School) => {
      this.school = school;
      this.selectedStudent = undefined;
      this.studentList = [];
      if (this.selectedTabIndex === 0) {
        this.syncStudentList(false);
      } else {
        this.syncStudentList(true);
      }
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  /** Single source of truth for which list the template iterates over - the Active/Archived
   *  tablist above shares one tabpanel (.fb-student-list) rather than each tab owning its
   *  own body. */
  get displayedStudents(): Student[] {
    return this.selectedTabIndex === 0 ? this.students : this.archivedStudents;
  }

  get activeCount(): number {
    return this.students.length;
  }

  get archivedCount(): number {
    return this.archivedStudents.length;
  }

  initials(student: Student): string {
    const first = student.user?.firstname?.charAt(0) || '';
    const last = student.user?.lastname?.charAt(0) || '';
    return (first + last).toUpperCase();
  }

  isExamReady(student: Student): boolean {
    const statistic = student.statistic;
    return !!(
      statistic?.nbFlights && statistic.nbFlights > 50 &&
      statistic?.nbStartplaces && statistic.nbStartplaces >= 5 &&
      statistic?.nbLandingplaces && statistic.nbLandingplaces >= 5 &&
      statistic?.nbFlightsAlone && statistic.nbFlightsAlone >= 1 &&
      student.controlSheet?.passTheoryExam
    );
  }

  syncStudentList(archived: boolean, onlyChangeStatistics: boolean = false) {
    if (this.school?.id) {
      this.schoolService.getStudentsBySchoolId(this.school.id, archived).pipe(takeUntil(this.unsubscribe$)).subscribe((students: Student[]) => {
        if (archived) {
          this.archivedStudents = students.sort(((obj1, obj2) => (obj1.user?.firstname && obj2.user?.firstname && obj1.user?.firstname > obj2.user?.firstname ? 1 : -1)));
          this.selectedStudent = this.archivedStudents[0];
        } else {
          this.students = students
          this.selectSort(this.sortBy);
          if (onlyChangeStatistics) {
            // Only update statistic and last flight without changing the selected student
            const student = this.students.find((student: Student) => student.id === this.selectedStudent?.id);
            if (student) {
              this.selectedStudent!.statistic = student.statistic;
              this.selectedStudent!.lastFlight = student.lastFlight;
            }
          } else {
            this.selectedStudent = this.students[0];
          }
        }
      })
    }
  }

  updateFlightsBadge(event: string) {
    if (this.selectedStudent?.countNotValidatedFlights == undefined) {
      return;
    }

    if (this.selectedTabIndex === 0) {
      this.syncStudentList(false, true);
    } else {
      this.syncStudentList(true, true);
    }
  }

  studentDetail(student: Student) {
    if (this.deviceSize.isMobile()) {
      this.sidenav?.close();
    }
    this.selectedStudent = student;
  }

  backButton() {
    this.sidenav?.open();
  }

  checkboxChange(changeEvent: MatCheckboxChange, student: Student) {
    if (changeEvent.checked) {
      this.studentList.push(student);
    } else {
      let index = this.studentList.findIndex(element => element.user?.id === student.user?.id);
      this.studentList.splice(index, 1)
    }
  }

  openEmailDialog() {
    const dialogRef = this.dialog.open(EmailDialogComponent, {
      data: {
        title: this.translate.instant('student.addStudent')
      },
      width: "500px",
      panelClass: "fb-email-dialog-panel"
    });

    dialogRef.afterClosed().subscribe(response => {
      if (response?.event === "send") {
        this.addStudent(response.value);
      }
    });
  }

  addStudent(email: string) {
    const student = this.students.find((student: Student) => student.user?.email?.toLowerCase() == email);
    if (student) {
      this.snackBar.open(this.translate.instant('formMessage.emailAlreadyAdded'), this.translate.instant('buttons.done'), {
        horizontalPosition: 'center',
        verticalPosition: 'top',
      });
      return;
    }

    if (!this.school?.id) {
      return;
    }

    this.schoolService.postStudentsEnrollment(this.school?.id, email).pipe(takeUntil(this.unsubscribe$)).subscribe(() => {
      this.snackBar.open(this.translate.instant('formMessage.requestSent'), this.translate.instant('buttons.done'), {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
      });
    });
  }

  tabChange(index: number) {
    this.selectedTabIndex = index;
    if (index === 0) {
      this.syncStudentList(false);
    } else {
      this.syncStudentList(true);
    }
  }

  /** WAI-ARIA APG tabs pattern: Left/Right (with wrap-around) and Home/End move focus and
   *  select the tab, keeping the tablist a single Tab stop (roving tabindex in the template). */
  onTabKeydown(event: KeyboardEvent): void {
    const buttons = this.tabButtons?.toArray();
    if (!buttons || buttons.length === 0) {
      return;
    }

    const count = buttons.length;
    let newIndex: number;
    switch (event.key) {
      case 'ArrowLeft':
        newIndex = (this.selectedTabIndex - 1 + count) % count;
        break;
      case 'ArrowRight':
        newIndex = (this.selectedTabIndex + 1) % count;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = count - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.tabChange(newIndex);
    buttons[newIndex].nativeElement.focus();
  }

  selectSort(sortBy: string) {
    this.sortBy = sortBy;
    this.students = this.students.sort((a, b) => {
      if (sortBy === 'firstname') {
        return (a.user?.firstname || '').localeCompare(b.user?.firstname || '');
      } else if (sortBy === 'lastname') {
        return (a.user?.lastname || '').localeCompare(b.user?.lastname || '');
      } else if (sortBy === 'nbFlightsAsc') {
        return (a.statistic?.nbFlights || 0) - (b.statistic?.nbFlights || 0);
      } else if (sortBy === 'nbFlightsDesc') {
        return (b.statistic?.nbFlights || 0) - (a.statistic?.nbFlights || 0);
      } else if (sortBy === 'countNotValidatedFlights') {
        return (b.countNotValidatedFlights || 0) - (a.countNotValidatedFlights || 0);
      }
      return 0;
    });
  }
}
