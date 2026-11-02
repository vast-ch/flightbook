import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subject, Subscription, takeUntil } from 'rxjs';
import { AccountService } from 'src/app/core/services/account.service';
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
  school?: School;
  teamMembers: TeamMember[];
  readonly teamPageSize = 4;
  teamPage = 0;
  // Held so a slow response for a previous school cannot land after a switch.
  private teamSubscription: Subscription | undefined;

  unsubscribe$ = new Subject<void>();

  // MainComponent, the route parent, fills this; no request of our own.
  get currentUser(): User | undefined {
    return this.accountService.currentUser$();
  }

  get teamPageCount(): number {
    return Math.max(1, Math.ceil(this.teamMembers.length / this.teamPageSize));
  }

  get pagedMembers(): TeamMember[] {
    const start = this.teamPage * this.teamPageSize;
    return this.teamMembers.slice(start, start + this.teamPageSize);
  }

  get pagerRange(): { from: number, to: number, total: number } {
    const start = this.teamPage * this.teamPageSize;
    return {
      from: start + 1,
      to: Math.min(start + this.teamPageSize, this.teamMembers.length),
      total: this.teamMembers.length
    };
  }

  constructor(
    private translate: TranslateService,
    private schoolService: SchoolService,
    private accountService: AccountService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.teamMembers = [];
  }

  ngOnInit(): void {
    this.school = this.accountService.currentSelectedSchool;
    if (this.school) {
      this.syncTeamMemberList();
    }

    this.accountService.changeSelectedSchool$.pipe(takeUntil(this.unsubscribe$)).subscribe((school: School) => {
      this.school = school;
      this.teamMembers = [];
      this.teamPage = 0;
      this.syncTeamMemberList();
    })
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  syncTeamMemberList() {
    if (this.school?.id) {
      this.teamSubscription?.unsubscribe();
      this.teamSubscription = this.schoolService.getTeamMembers(this.school.id).pipe(takeUntil(this.unsubscribe$)).subscribe((teamMembers: TeamMember[]) => {
        this.teamMembers = teamMembers.sort(((member1, member2) => (member1?.user?.firstname && member2?.user?.firstname && member1?.user?.firstname > member2?.user?.firstname ? 1 : -1)));
        this.teamPage = Math.min(this.teamPage, this.teamPageCount - 1);
      })
    }
  }

  openEmailDialog() {
    const dialogRef = this.dialog.open(EmailDialogComponent, {
      data: {
        title: this.translate.instant('team.addMember')
      },
      width: "500px",
      panelClass: "fb-email-dialog-panel"
    });

    dialogRef.afterClosed().pipe(takeUntil(this.unsubscribe$)).subscribe(response => {
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

  // Translation key explaining why this member cannot be removed, or null if they can.
  removeBlockedKey(member: TeamMember): string | null {
    if (member.admin) {
      return 'team.cannotRemoveOwner';
    }
    return this.currentUser?.email === member.user.email ? 'team.cannotRemoveSelf' : null;
  }

  initials(member: TeamMember): string {
    const first = member.user.firstname?.charAt(0) || '';
    const last = member.user.lastname?.charAt(0) || '';
    return (first + last).toUpperCase();
  }

  previousPage() {
    this.teamPage = Math.max(this.teamPage - 1, 0);
  }

  nextPage() {
    this.teamPage = Math.min(this.teamPage + 1, this.teamPageCount - 1);
  }

}
