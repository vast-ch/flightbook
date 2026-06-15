import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule, MatTabChangeEvent, MatTabGroup } from '@angular/material/tabs';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
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
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatBadgeModule,
    MatTooltipModule,
    TranslateModule,
    TandemPilotDetailComponent
  ]
})
export class TandemPilotsComponent implements OnInit, OnDestroy {
  school: School | undefined;
  selectedTandemPilot: TandemPilot | undefined;
  @ViewChild(MatSidenav) sidenav: MatSidenav | undefined;
  @ViewChild(MatTabGroup) tabGroup: MatTabGroup | undefined;
  unsubscribe$ = new Subject<void>();

  tandemPilots: TandemPilot[];
  archivedTandemPilots: TandemPilot[];

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
  }

  ngOnInit(): void {
    this.school = this.accountService.currentSelectedSchool;
    if (this.school) {
      this.syncTandemPilotList(false);
    }
    this.accountService.changeSelectedSchool$.pipe(takeUntil(this.unsubscribe$)).subscribe((school: School) => {
      this.school = school;
      this.selectedTandemPilot = undefined;
      if (this.tabGroup?.selectedIndex == 0) {
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

  syncTandemPilotList(archived: boolean) {
    if (this.school?.id) {
      this.schoolService.getTandemPilotsBySchoolId(this.school.id, archived).pipe(takeUntil(this.unsubscribe$)).subscribe((tandemPilots: TandemPilot[]) => {
        if (archived) {
          this.archivedTandemPilots = tandemPilots.sort(((obj1, obj2) => (obj1.user?.firstname && obj2.user?.firstname && obj1.user?.firstname > obj2.user?.firstname ? 1 : -1)));
          this.selectedTandemPilot = this.archivedTandemPilots[0];
        } else {
          this.tandemPilots = tandemPilots.sort(((obj1, obj2) => (obj1.user?.firstname && obj2.user?.firstname && obj1.user?.firstname > obj2.user?.firstname ? 1 : -1)));
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
      width: "500px"
    });

    dialogRef.afterClosed().subscribe(response => {
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

  tabChange(event: MatTabChangeEvent) {
    if (event.index == 0) {
      this.syncTandemPilotList(false);
    } else {
      this.syncTandemPilotList(true);
    }
  }

  exportAllPilotsData() {
    const dialogRef = this.dialog.open(ExportDialogComponent, {
      width: '500px',
      data: {
        title: this.translate.instant('export.exportAllPilotsData')
      }
    });

    dialogRef.afterClosed().subscribe(result => {
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
