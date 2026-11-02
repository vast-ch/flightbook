import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, Signal, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TandemPilot } from 'src/app/shared/domain/tandem-pilot';
import { School } from 'src/app/shared/domain/school';
import { Flight } from 'src/app/shared/domain/flight';
import { DeviceSizeService } from 'src/app/core/services/device-size.service';
import { finalize, firstValueFrom, Subject, Subscription, takeUntil } from 'rxjs';
import { SchoolService } from 'src/app/core/services/school.service';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { PassengerConfirmation } from 'src/app/shared/domain/passenger-confirmation';
import { PagerEntity } from 'src/app/shared/domain/pagerEntity';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TandemSchoolPaymentState } from 'src/app/shared/domain/tandem-school-payment-state';
import { CustomFieldDefinition } from 'src/app/shared/domain/school-config';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PaymentFormDialogComponent } from '../payment-form-dialog/payment-form-dialog.component';
import { ExportDialogComponent } from '../export-dialog/export-dialog.component';
import { ExportTandemDataService } from 'src/app/core/services/export-tandem-data.service';

@Component({
  selector: 'fb-tandem-pilot-detail',
  templateUrl: './tandem-pilot-detail.component.html',
  styleUrls: ['./tandem-pilot-detail.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    FormsModule,
    TranslateModule
  ],
  providers: [DatePipe]
})
export class TandemPilotDetailComponent implements OnChanges, OnDestroy {
  @Input()
  tandemPilot: TandemPilot | undefined;

  @Input()
  school: School | undefined;

  /** The list is still loading, so "no pilot selected" would only be a flash. */
  @Input()
  listLoading = false;

  @Output() backButtonClick = new EventEmitter();
  @Output() removeUserButtonClick = new EventEmitter();

  flights: Flight[] = [];
  flightsPagerEntity: PagerEntity<Flight[]> = new PagerEntity<Flight[]>();

  passengerConfirmations: PassengerConfirmation[] = [];
  passengerConfirmationsPagerEntity: PagerEntity<PassengerConfirmation[]> = new PagerEntity<PassengerConfirmation[]>();
  unsubscribe$ = new Subject<void>();

  readonly currentYear = new Date().getFullYear();
  periods: (number | 'total')[] = ['total', this.currentYear, this.currentYear - 1]; // @TODO make this dynamic. Need an dedicated statistics endpoint for tandem pilots to get the years with flights. For now, just show the current year and the previous year.
  period: number | 'total' = this.currentYear;

  flightsLoading = false;
  passengersLoading = false;
  // Held per table so a newer load can cancel an older one: rapid pilot or period clicks must
  // never let a slower, older response overwrite the current data.
  private flightsSubscription: Subscription | undefined;
  private passengersSubscription: Subscription | undefined;

  @ViewChild('passengerConfirmationsPaginator') passengerConfirmationsPaginator: MatPaginator | undefined;
  @ViewChild('flightsPaginator') flightsPaginator: MatPaginator | undefined;

  displayedFlightColumns: string[] = [];
  displayedPassengerColumns: string[] = ['date', 'name', 'place', 'phone', 'email', 'canUseData'];

  // Expose enum for template access
  TandemSchoolPaymentState = TandemSchoolPaymentState;

  get isMobile(): Signal<boolean> {
    return this.deviceSize.isMobile;
  }

  constructor(
    private deviceSize: DeviceSizeService,
    private schoolService: SchoolService,
    private translate: TranslateService,
    private dialog: MatDialog,
    private datePipe: DatePipe,
    private exportService: ExportTandemDataService
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['school'] && changes['school'].currentValue) {
      this.buildDisplayedFlightColumns();
    }
    
    if (changes['tandemPilot'] && changes['tandemPilot'].currentValue) {
      this.reloadTables();
    }
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  selectPeriod(period: number | 'total') {
    if (period === this.period) {
      return;
    }

    this.period = period;
    this.reloadTables(this.flightsPaginator?.pageSize, this.passengerConfirmationsPaginator?.pageSize);
  }

  /** Pilot or period changed: drop the old rows and counts first, so nothing from the previous
   *  selection stays on screen while both tables load from page 1. A given page size also stays
   *  on the cleared pager entity: the paginator binds to it, and would otherwise fall back to 5
   *  until the response arrives, so a second quick period click would read 5. */
  private reloadTables(flightsLimit?: number, passengersLimit?: number) {
    this.flights = [];
    this.flightsPagerEntity = new PagerEntity<Flight[]>();
    this.flightsPagerEntity.itemsPerPage = flightsLimit;
    this.passengerConfirmations = [];
    this.passengerConfirmationsPagerEntity = new PagerEntity<PassengerConfirmation[]>();
    this.passengerConfirmationsPagerEntity.itemsPerPage = passengersLimit;

    this.loadFlights(undefined, flightsLimit);
    if (this.tandemPilot?.id) {
      this.loadPassengerConfirmations(this.tandemPilot.id, undefined, passengersLimit);
    }
  }

  /** Both bounds or neither: the confirmations endpoint only works with both. */
  private periodRange(): { from?: string, to?: string } {
    return this.period === 'total' ? {} : { from: `${this.period}-01-01`, to: `${this.period}-12-31` };
  }

  loadFlights(offset: number | undefined = undefined, limit = 5) {
    if (!this.tandemPilot?.id) return;

    if (!offset && this.flightsPaginator) {
      this.flightsPaginator.pageIndex = 0;
    }

    // Unsubscribing runs the previous request's finalize, so the flag is set after it. Paging keeps
    // its rows on screen, which leaves the flag needed only while the table is empty.
    this.flightsSubscription?.unsubscribe();
    this.flightsLoading = this.flights.length === 0;

    this.flightsSubscription = this.schoolService.getTandemPilotFlightsBySchoolIdAndTandemPilotId({ limit, offset, ...this.periodRange() }, this.school!.id!, this.tandemPilot.id)
      .pipe(takeUntil(this.unsubscribe$), finalize(() => this.flightsLoading = false))
      .subscribe((pagerEntity) => {
        this.flightsPagerEntity = pagerEntity;
        this.flights = pagerEntity.entity || [];
      });
  }

  loadPassengerConfirmations(tandemPilotId: number, offset: number | undefined = undefined, limit = 5) {
    if (!offset && this.passengerConfirmationsPaginator) {
      this.passengerConfirmationsPaginator.pageIndex = 0;
    }

    this.passengersSubscription?.unsubscribe();
    this.passengersLoading = this.passengerConfirmations.length === 0;

    this.passengersSubscription = this.schoolService.getPassengerConfirmationsBySchoolIdAndTandemPilotId({ limit, offset, ...this.periodRange() }, this.school!.id!, tandemPilotId)
      .pipe(takeUntil(this.unsubscribe$), finalize(() => this.passengersLoading = false))
      .subscribe((pagerEntity) => {
        this.passengerConfirmationsPagerEntity = pagerEntity;
        this.passengerConfirmations = pagerEntity.entity || [];
      });
  }

  handlePassengerConfirmationPage(event: any) {
    let offset = event.pageIndex * event.pageSize;
    if (this.tandemPilot?.id) {
      this.loadPassengerConfirmations(this.tandemPilot?.id, offset, event.pageSize);
    }
  }

  handleFlightsPage(event: any) {
    let offset = event.pageIndex * event.pageSize;
    if (this.tandemPilot?.id) {
      this.loadFlights(offset, event.pageSize);
    }
  }

  getActiveCustomFields(): CustomFieldDefinition[] {
    if (!this.school?.configuration?.tandemModule?.flightConfig?.customFields) {
      return [];
    }
    return this.school.configuration.tandemModule.flightConfig.customFields.filter(f => !f.disabled);
  }

  buildDisplayedFlightColumns(): void {
    const baseColumns = ['paymentButtons', 'nb', 'date', 'start', 'landing', 'glider', 'time', 'km', 'description'];
    const customFieldKeys = this.getActiveCustomFields().map(f => f.key);
    const paymentColumns = ['editor', 'paymentAmount', 'paymentState'];
    
    this.displayedFlightColumns = [...baseColumns, ...customFieldKeys, ...paymentColumns];
  }

  getCustomFieldValue(flight: Flight, key: string): any {
    if (!flight.tandemSchoolData?.schoolCustomValues) {
      return null;
    }
    const customValue = flight.tandemSchoolData.schoolCustomValues.find(cv => cv.key === key);
    return customValue ? customValue.value : null;
  }

  formatCustomFieldValue(value: any, type: string): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    switch (type) {
      case 'date':
        return this.datePipe.transform(value, 'dd.MM.yyyy') || '';
      case 'boolean':
        return value ? this.translate.instant('buttons.yes') : this.translate.instant('buttons.no');
      case 'number':
        return value.toString();
      case 'text':
      case 'dropdown':
      default:
        return value.toString();
    }
  }

  backButton() {
    this.backButtonClick.emit();
  }

  async archiveTandemPilot() {
    const confirmationMessage = this.translate.instant('tandemPilot.archiveTandemPilotMessage').replace("$REPLACE_NAME", `${this.tandemPilot?.user?.firstname} ${this.tandemPilot?.user?.lastname}`);
    if (!confirm(confirmationMessage)) {
      return;
    }

    if (!this.tandemPilot?.id) {
      return;
    }

    await firstValueFrom(this.schoolService.archiveTandemPilot(this.school?.id!, this.tandemPilot!));

    this.removeUserButtonClick.emit("deleted");
  }

  managePaymentModal(flight: Flight, paymentState: TandemSchoolPaymentState) {
    const dialogRef = this.dialog.open(PaymentFormDialogComponent, {
      width: '500px',
      data: { 
        paymentState
      },
      panelClass: 'fb-email-dialog-panel'
    });

    dialogRef.afterClosed().pipe(takeUntil(this.unsubscribe$)).subscribe(result => {
      if (result && this.school?.id && this.tandemPilot?.id) {
        flight.tandemSchoolData = {
          paymentState: paymentState,
          paymentAmount: result.amount == undefined ? null : result.amount,
          paymentComment: result.comment == '' ? null : result.comment
        };

        this.schoolService.validateTandemPilotFlightSchoolIdAndStudentId(
          this.school.id,
          this.tandemPilot,
          flight
        ).pipe(takeUntil(this.unsubscribe$))
          .subscribe(() => {
            this.loadFlights();
          });
      }
    });
  }

  exportPilotData() {
    const dialogRef = this.dialog.open(ExportDialogComponent, {
      width: '500px',
      data: {
        title: this.translate.instant('export.exportPilotData')
      },
      panelClass: 'fb-email-dialog-panel'
    });

    dialogRef.afterClosed().pipe(takeUntil(this.unsubscribe$)).subscribe(result => {
      if (result && this.school?.id && this.tandemPilot?.id) {
        const schoolId = this.school.id;
        const tandemPilotId = this.tandemPilot.id;
        const tandemPilot = this.tandemPilot;
        
        this.schoolService.getAllTandemPilotFlights(schoolId, tandemPilotId)
          .pipe(takeUntil(this.unsubscribe$))
          .subscribe(flightsResponse => {
            this.schoolService.getAllPassengerConfirmations(schoolId, tandemPilotId)
              .pipe(takeUntil(this.unsubscribe$))
              .subscribe(passengersResponse => {
                const customFields = this.getActiveCustomFields();
                this.exportService.exportTandemPilotData(
                  tandemPilot,
                  flightsResponse.entity || [],
                  passengersResponse.entity || [],
                  customFields,
                  result
                );
              });
          });
      }
    });
  }
}
