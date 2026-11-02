import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize, Subject, Subscription, takeUntil } from 'rxjs';
import { AccountService } from 'src/app/core/services/account.service';
import { SchoolService } from 'src/app/core/services/school.service';
import { DeviceSizeService } from 'src/app/core/services/device-size.service';
import { School } from 'src/app/shared/domain/school';
import { TandemPilot } from 'src/app/shared/domain/tandem-pilot';
import { TandemPilotDetailComponent } from '../../component/tandem-pilot-detail/tandem-pilot-detail.component';
import { EmailDialogComponent } from '../../component/email-dialog/email-dialog.component';
import { ExportDialogComponent } from '../../component/export-dialog/export-dialog.component';
import { ExportTandemDataService } from 'src/app/core/services/export-tandem-data.service';
import { Flight } from 'src/app/shared/domain/flight';
import { PassengerConfirmation } from 'src/app/shared/domain/passenger-confirmation';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'fb-tandem-pilots',
  templateUrl: './tandem-pilots.component.html',
  styleUrls: ['./tandem-pilots.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
    TranslateModule,
    TandemPilotDetailComponent
  ]
})
export class TandemPilotsComponent implements OnInit, OnDestroy {
  school: School | undefined;
  selectedTandemPilot: TandemPilot | undefined;
  @ViewChild(MatSidenav) sidenav: MatSidenav | undefined;
  @ViewChildren('tabButton') tabButtons: QueryList<ElementRef<HTMLButtonElement>> | undefined;
  unsubscribe$ = new Subject<void>();

  tandemPilots: TandemPilot[];
  archivedTandemPilots: TandemPilot[];
  sortBy: string = 'firstname';
  selectedTabIndex = 0;
  // Starts true: on a page reload the school only arrives after the first render.
  listLoading = true;
  // Held so a newer load can cancel an older one: rapid tab changes must never let a slower
  // response select a pilot from the list that is no longer displayed.
  private listSubscription: Subscription | undefined;

  constructor(
    private translate: TranslateService,
    private schoolService: SchoolService,
    private accountService: AccountService,
    private snackBar: MatSnackBar,
    public dialog: MatDialog,
    private deviceSize: DeviceSizeService,
    private exportService: ExportTandemDataService
  ) {
    this.tandemPilots = [];
    this.archivedTandemPilots = [];

    effect(() => {
      if (!this.deviceSize.isMobile()) {
        this.sidenav?.open();
      }
    });
  }

  ngOnInit(): void {
    this.school = this.accountService.currentSelectedSchool;
    if (this.school) {
      this.syncTandemPilotList(false);
    }
    this.accountService.changeSelectedSchool$.pipe(takeUntil(this.unsubscribe$)).subscribe((school: School) => {
      this.school = school;
      this.selectedTandemPilot = undefined;
      if (this.selectedTabIndex === 0) {
        this.syncTandemPilotList(false);
      } else {
        this.syncTandemPilotList(true);
      }
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  /** Both tabs share one tabpanel, so this is the only list the template iterates over. */
  get displayedTandemPilots(): TandemPilot[] {
    return this.selectedTabIndex === 0 ? this.tandemPilots : this.archivedTandemPilots;
  }

  initials(tandemPilot: TandemPilot): string {
    const first = tandemPilot.user?.firstname?.charAt(0) || '';
    const last = tandemPilot.user?.lastname?.charAt(0) || '';
    return (first + last).toUpperCase();
  }

  syncTandemPilotList(archived: boolean) {
    if (this.school?.id) {
      // Unsubscribing runs the previous request's finalize, so the flag is set after it.
      this.listSubscription?.unsubscribe();
      this.listLoading = true;

      this.listSubscription = this.schoolService.getTandemPilotsBySchoolId(this.school.id, archived).pipe(takeUntil(this.unsubscribe$), finalize(() => this.listLoading = false)).subscribe((tandemPilots: TandemPilot[]) => {
        if (archived) {
          this.archivedTandemPilots = this.sortTandemPilots(tandemPilots);
          this.selectedTandemPilot = this.archivedTandemPilots[0];
        } else {
          this.tandemPilots = this.sortTandemPilots(tandemPilots);
          this.selectedTandemPilot = this.tandemPilots[0];
        }
      })
    }
  }

  tandemPilotDetail(tandemPilot: TandemPilot) {
    if (this.deviceSize.isMobile()) {
      this.sidenav?.close();
    }
    this.selectedTandemPilot = tandemPilot;
  }

  backButton() {
    this.sidenav?.open();
  }

  openEmailDialog() {
    const dialogRef = this.dialog.open(EmailDialogComponent, {
      data: {
        title: this.translate.instant('tandemPilot.addTandemPilot')
      },
      width: "500px",
      panelClass: "fb-email-dialog-panel"
    });

    dialogRef.afterClosed().pipe(takeUntil(this.unsubscribe$)).subscribe(response => {
      if (response?.event === "send") {
        this.addTandemPilot(response.value);
      }
    });
  }

  addTandemPilot(email: string) {
    const tandemPilot = this.tandemPilots.find((pilot: TandemPilot) => pilot.user?.email?.toLowerCase() == email);
    if (tandemPilot) {
      this.snackBar.open(this.translate.instant('formMessage.emailAlreadyAdded'), this.translate.instant('buttons.done'), {
        horizontalPosition: 'center',
        verticalPosition: 'top',
      });
      return;
    }

    if (!this.school?.id) {
      return;
    }

    this.schoolService.postTandemPilotEnrollment(this.school?.id, email).pipe(takeUntil(this.unsubscribe$)).subscribe(() => {
      this.snackBar.open(this.translate.instant('formMessage.requestSent'), this.translate.instant('buttons.done'), {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
      });
    });
  }

  tabChange(index: number) {
    if (index === this.selectedTabIndex) {
      return;
    }

    this.selectedTabIndex = index;
    if (index === 0) {
      this.syncTandemPilotList(false);
    } else {
      this.syncTandemPilotList(true);
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
    this.tandemPilots = this.sortTandemPilots(this.tandemPilots);
    this.archivedTandemPilots = this.sortTandemPilots(this.archivedTandemPilots);
  }

  private sortTandemPilots(tandemPilots: TandemPilot[]): TandemPilot[] {
    const key = this.sortBy === 'lastname' ? 'lastname' : 'firstname';
    return [...tandemPilots].sort((a, b) => (a.user?.[key] || '').localeCompare(b.user?.[key] || ''));
  }

  exportAllPilotsData() {
    const dialogRef = this.dialog.open(ExportDialogComponent, {
      width: '500px',
      data: {
        title: this.translate.instant('export.exportAllPilotsData')
      },
      panelClass: 'fb-email-dialog-panel'
    });

    dialogRef.afterClosed().pipe(takeUntil(this.unsubscribe$)).subscribe(result => {
      if (result && this.school?.id) {
        forkJoin([
          this.schoolService.getTandemPilotsBySchoolId(this.school.id, false),
          this.schoolService.getTandemPilotsBySchoolId(this.school.id, true)
        ]).pipe(takeUntil(this.unsubscribe$))
          .subscribe(([activePilots, archivedPilots]) => {
            const allPilots = [...activePilots, ...archivedPilots];
            
            const flightsMap = new Map<number, Flight[]>();
            const passengersMap = new Map<number, PassengerConfirmation[]>();
            
            const requests = allPilots
              .filter(pilot => pilot.id && this.school?.id)
              .map(pilot => {
                const schoolId = this.school!.id!;
                const pilotId = pilot.id!;
                
                return forkJoin({
                  flights: this.schoolService.getAllTandemPilotFlights(schoolId, pilotId),
                  passengers: this.schoolService.getAllPassengerConfirmations(schoolId, pilotId),
                  pilotId: of(pilotId)
                });
              });

            if (requests.length === 0) {
              return;
            }

            forkJoin(requests).pipe(takeUntil(this.unsubscribe$))
              .subscribe(results => {
                results.forEach(data => {
                  flightsMap.set(data.pilotId, data.flights.entity || []);
                  passengersMap.set(data.pilotId, data.passengers.entity || []);
                });

                const customFields = this.school?.configuration?.tandemModule?.flightConfig?.customFields?.filter(f => !f.disabled) || [];
                
                this.exportService.exportAllTandemPilotsData(
                  allPilots,
                  flightsMap,
                  passengersMap,
                  customFields,
                  result
                );
              });
          });
      }
    });
  }
}
