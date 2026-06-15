import { Component, EventEmitter, OnDestroy, OnInit, Output, Signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { AccountService } from 'src/app/core/services/account.service';
import { DeviceSizeService } from 'src/app/core/services/device-size.service';
import { SchoolService } from 'src/app/core/services/school.service';
import { School } from 'src/app/shared/domain/school';
import { TeamMember } from 'src/app/shared/domain/team-member';
import { User } from 'src/app/shared/domain/user';
import { EmailDialogComponent } from '../../component/email-dialog/email-dialog.component';

@Component({
  selector: 'fb-team',
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.scss'],
  standalone: false
})
export class TeamComponent implements OnInit, OnDestroy {
  @Output() backButtonClick = new EventEmitter();
  school?: School;
  teamMembers: TeamMember[];
  currentUser?: User;

  unsubscribe$ = new Subject<void>();

  displayedColumns: string[] = ['firstname', 'lastname', 'email', 'remove'];

  get isMobile(): Signal<boolean> {
    return this.deviceSize.isMobile;
  }

  constructor(
    private translate: TranslateService,
    private schoolService: SchoolService,
    private accountService: AccountService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private deviceSize: DeviceSizeService
  ) {
    this.teamMembers = [];
  }

  ngOnInit(): void {
    this.accountService.currentUser().pipe(takeUntil(this.unsubscribe$)).subscribe((user: User) => {
      this.currentUser = user;
    });

    this.school = this.accountService.currentSelectedSchool;
    if (this.school) {
      this.syncTeamMemberList();
    }

    this.accountService.changeSelectedSchool$.pipe(takeUntil(this.unsubscribe$)).subscribe((school: School) => {
      this.school = school;
      this.syncTeamMemberList();
    })
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  syncTeamMemberList() {
    if (this.school?.id) {
      this.schoolService.getTeamMembers(this.school.id).pipe(takeUntil(this.unsubscribe$)).subscribe((teamMembers: TeamMember[]) => {
        this.teamMembers = teamMembers.sort(((member1, member2) => (member1?.user?.firstname && member2?.user?.firstname && member1?.user?.firstname > member2?.user?.firstname ? 1 : -1)));
      })
    }
  }

  openEmailDialog() {
    const dialogRef = this.dialog.open(EmailDialogComponent, {
      data: {
        title: this.translate.instant('team.addMember')
      },
      width: "500px"
    });

    dialogRef.afterClosed().subscribe(response => {
      if (response?.event === "send") {
        this.addTeamMember(response.value);
      }
    });
  }

  addTeamMember(email: string) {
    const teamMember = this.teamMembers.find((teamMember: TeamMember) => teamMember.user?.email?.toLowerCase() == email);
    if (teamMember) {
      this.snackBar.open(this.translate.instant('formMessage.emailAlreadyAdded'), this.translate.instant('buttons.done'), {
        horizontalPosition: 'center',
        verticalPosition: 'top',
      });
      return;
    }

    if (!this.school?.id) {
      return;
    }

    this.schoolService.postTeamMemberEnrollment(this.school?.id, email).pipe(takeUntil(this.unsubscribe$)).subscribe({
      next: () => {
        this.snackBar.open(this.translate.instant('formMessage.requestSent'), this.translate.instant('buttons.done'), {
          duration: 2000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      },
      complete: () => {
        this.syncTeamMemberList()
      }
    });
  }

  async removeMember(teamMember: TeamMember) {
    if (!this.school?.id) {
      return;
    }

    const confirmationMessage = this.translate.instant('team.removeMessage').replace("$REPLACE_NAME", `${teamMember.user?.firstname} ${teamMember.user?.lastname}`);
    if (!confirm(confirmationMessage)) {
      return;
    }

    await firstValueFrom(this.schoolService.deleteTeamMember(this.school?.id, teamMember))
    this.syncTeamMemberList();
  }

  backButton() {
    this.backButtonClick.emit();
  }

}
