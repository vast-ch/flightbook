import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { TranslateService } from '@ngx-translate/core';
import { finalize, firstValueFrom, Subject, Subscription, takeUntil } from 'rxjs';
import { AccountService } from 'src/app/core/services/account.service';
import { SchoolService } from 'src/app/core/services/school.service';
import { AppointmentType } from 'src/app/shared/domain/appointment-type-dto';
import { School } from 'src/app/shared/domain/school';
import { AppointmentTypeDialogComponent } from '../appointment-type-dialog/appointment-type-dialog.component';
import { TeamMember } from 'src/app/shared/domain/team-member';

@Component({
  selector: 'fb-appointment-type',
  templateUrl: './appointment-type.component.html',
  styleUrls: ['./appointment-type.component.scss'],
  standalone: false
})
export class AppointmentTypeComponent implements OnInit, OnDestroy {

  school?: School;
  appointmentTypes: AppointmentType[];
  displayedColumns: string[] = ['name', 'color', 'archived', 'edit'];
  // Starts true: on a page reload the school only arrives after the first render.
  typesLoading = true;
  private openingForm = false;
  // Held so a slow response for a previous school cannot land after a switch.
  private typesSubscription: Subscription | undefined;

  unsubscribe$ = new Subject<void>();

  constructor(
    private translate: TranslateService,
    private schoolService: SchoolService,
    private accountService: AccountService,
    private dialog: MatDialog
  ) {
    this.appointmentTypes = [];
  }

  ngOnInit(): void {
    this.school = this.accountService.currentSelectedSchool;
    if (this.school) {
      this.syncAppoiontmentTypeList();
    }

    this.accountService.changeSelectedSchool$.pipe(takeUntil(this.unsubscribe$)).subscribe((school: School) => {
      this.school = school;
      this.appointmentTypes = [];
      this.syncAppoiontmentTypeList();
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  syncAppoiontmentTypeList() {
    if (this.school?.id) {
      // Unsubscribing runs the previous request's finalize, so the flag is set after it.
      this.typesSubscription?.unsubscribe();
      this.typesLoading = true;

      this.typesSubscription = this.schoolService.getAppointmentTypesBySchoolId(this.school.id).pipe(takeUntil(this.unsubscribe$), finalize(() => this.typesLoading = false)).subscribe((appointmentTypes: AppointmentType[]) => {
        this.appointmentTypes = appointmentTypes;
      })
    }
  }

  /** Fetched per open: this card lives beside Team, so a kept list would go stale. */
  openAppointmentTypeForm(type?: AppointmentType) {
    const school = this.school;
    if (!school?.id || this.openingForm) {
      return;
    }

    this.openingForm = true;
    this.schoolService.getTeamMembers(school.id)
      .pipe(finalize(() => this.openingForm = false), takeUntil(this.unsubscribe$))
      .subscribe((teamMembers: TeamMember[]) => {
        if (school === this.school) {
          const sortedMembers = teamMembers.sort(((member1, member2) => (member1?.user?.firstname && member2?.user?.firstname && member1?.user?.firstname > member2?.user?.firstname ? 1 : -1)));
          this.openTypeDialog(sortedMembers, type);
        }
      });
  }

  private openTypeDialog(teamMembers: TeamMember[], type?: AppointmentType) {
    let isNew = false;
    if (!type) {
      type = new AppointmentType();
      type.archived = false;
      isNew = true
    }
    const dialogRef = this.dialog.open(AppointmentTypeDialogComponent, {
      data: {
        title: this.translate.instant(isNew ? 'appointmentType.addType' : 'appointmentType.editType'),
        type: type,
        teamMembers: teamMembers,
      },
      width: "500px",
      panelClass: "fb-email-dialog-panel"
    });

    dialogRef.afterClosed().pipe(takeUntil(this.unsubscribe$)).subscribe(response => {
      if (response?.event === "save") {
        if (isNew) {
          this.addAppointmentType(response.value);
        } else {
          this.updateAppointmentType(response.value);
        }
      }
    });
  }

  addAppointmentType(appointmentType: AppointmentType) {
    if (!this.school?.id) {
      return;
    }

    this.schoolService.postAppointmentType(this.school?.id, appointmentType).pipe(takeUntil(this.unsubscribe$)).subscribe({
      complete: () => {
        this.syncAppoiontmentTypeList();
      }
    });
  }

  async updateAppointmentType(type: AppointmentType) {
    if (this.school?.id) {
      await firstValueFrom(this.schoolService.putAppointmentType(this.school?.id, type));
      this.syncAppoiontmentTypeList();
    }
  }

  async change(event: MatSlideToggleChange, type: AppointmentType) {
    type.archived = event.checked;
    this.updateAppointmentType(type);
  }

  async changeColor(color: string, type: AppointmentType) {
    type.color = color;
    this.updateAppointmentType(type);
  }
}
