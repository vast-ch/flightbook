import { Component, EventEmitter, OnDestroy, OnInit, Output, Signal } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { AccountService } from 'src/app/core/services/account.service';
import { DeviceSizeService } from 'src/app/core/services/device-size.service';
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

  @Output() backButtonClick = new EventEmitter();

  color: ThemePalette = 'primary';
  school?: School;
  appointmentTypes: AppointmentType[];
  displayedColumns: string[] = ['name', 'color', 'archived', 'edit'];
  teamMembers: TeamMember[];
  get isMobile(): Signal<boolean> {
    return this.deviceSize.isMobile;
  }

  unsubscribe$ = new Subject<void>();

  constructor(
    private translate: TranslateService,
    private schoolService: SchoolService,
    private accountService: AccountService,
    private dialog: MatDialog,
    private deviceSize: DeviceSizeService
  ) {
    this.appointmentTypes = [];
    this.teamMembers = [];
  }

  ngOnInit(): void {
    this.school = this.accountService.currentSelectedSchool;
    if (this.school) {
      this.syncAppoiontmentTypeList();
      this.syncTeamMemberList();
    }

    this.accountService.changeSelectedSchool$.pipe(takeUntil(this.unsubscribe$)).subscribe((school: School) => {
      this.school = school;
      this.syncAppoiontmentTypeList();
      this.syncTeamMemberList();
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  syncAppoiontmentTypeList() {
    if (this.school?.id) {
      this.schoolService.getAppointmentTypesBySchoolId(this.school.id).pipe(takeUntil(this.unsubscribe$)).subscribe((appointmentTypes: AppointmentType[]) => {
        this.appointmentTypes = appointmentTypes;
      })
    }
  }

  syncTeamMemberList() {
    if (this.school?.id) {
      this.schoolService.getTeamMembers(this.school.id).pipe(takeUntil(this.unsubscribe$)).subscribe((teamMembers: TeamMember[]) => {
        this.teamMembers = teamMembers.sort(((member1, member2) => (member1?.user?.firstname && member2?.user?.firstname && member1?.user?.firstname > member2?.user?.firstname ? 1 : -1)));
      })
    }
  }

  openAppointmentTypeForm(type?: AppointmentType) {
    let isNew = false;
    if (!type) {
      type = new AppointmentType();
      type.archived = false;
      isNew = true
    }
    const dialogRef = this.dialog.open(AppointmentTypeDialogComponent, {
      data: {
        title: this.translate.instant('appointmentType.addType'),
        type: type,
        teamMembers: this.teamMembers,
      },
      width: "500px"
    });

    dialogRef.afterClosed().subscribe(response => {
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

  backButton() {
    this.backButtonClick.emit();
  }
}
