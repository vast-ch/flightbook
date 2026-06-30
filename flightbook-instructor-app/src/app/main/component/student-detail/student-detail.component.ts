import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, Signal, SimpleChanges, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { DeviceSizeService } from 'src/app/core/services/device-size.service';
import { PdfExportService } from 'src/app/core/services/pdf-export.service';
import { StudentService } from 'src/app/core/services/student.service';
import { ControlSheet } from 'src/app/shared/domain/control-sheet';
import { EmergencyContact } from 'src/app/shared/domain/emergency-contact';
import { Flight } from 'src/app/shared/domain/flight';
import { FlightValidationState } from 'src/app/shared/domain/flight-validation-state';
import { PagerEntity } from 'src/app/shared/domain/pagerEntity';
import { School } from 'src/app/shared/domain/school';
import { Student } from 'src/app/shared/domain/student';
import { ArchiveStudentDialogComponent } from '../archive-student-dialog/archive-student-dialog.component';

@Component({
  selector: 'fb-student-detail',
  templateUrl: './student-detail.component.html',
  styleUrls: ['./student-detail.component.scss'],
  standalone: false
})
export class StudentDetailComponent implements OnInit, OnChanges, OnDestroy {
  @Input()
  student: Student | undefined;

  @Input()
  school: School | undefined;

  @Output() backButtonClick = new EventEmitter();

  @Output() removeUserButtonClick = new EventEmitter();
  @Output() validateFlightsButtonClick = new EventEmitter();

  flights: Flight[];
  flightPagerEntity = new PagerEntity<Flight[]>;
  @ViewChild('paginator') paginator: MatPaginator | undefined;

  displayedColumns: string[] = ['nb', 'date', 'start', 'landing', 'glider', 'time', 'km', 'description', 'instructor', 'alone'];
  emergencyContact: EmergencyContact = new EmergencyContact();
  @ViewChild('table', { read: ElementRef }) table: ElementRef | undefined;
  unsubscribe$ = new Subject<void>();

  // For reject comment modal
  showRejectCommentBox = false;
  rejectComment: string = '';
  flightToReject: Flight | null = null;

  get isMobile(): Signal<boolean> {
    return this.deviceSize.isMobile;
  }

  constructor(
    private studentService: StudentService,
    private deviceSize: DeviceSizeService,
    private translate: TranslateService,
    private pdfExportService: PdfExportService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.flights = [];
  }

  ngOnInit(): void { }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['student'] && changes['student'].currentValue) {
      this.loadStudentFLights(changes['student'].currentValue.id);
      this.studentService.getEmergencyContactsByStudentId(changes['student'].currentValue.id).pipe(takeUntil(this.unsubscribe$)).subscribe((emergencyContacts: EmergencyContact[]) => {
        if (emergencyContacts?.length > 0) {
          this.emergencyContact = emergencyContacts[0];
        }
      });
    }

    // Update displayedColumns when school changes
    if (changes['school'] && changes['school'].currentValue) {
      // Reset to base columns first to avoid duplicates
      this.displayedColumns = ['nb', 'date', 'start', 'landing', 'glider', 'time', 'km', 'description', 'instructor', 'alone'];
      
      // Add validation column if needed
      if (changes['school'].currentValue.configuration?.schoolModule?.validateFlights) {
        this.displayedColumns.push('validationState');
        this.displayedColumns.push('validationButton');
      }
    }
  }

  loadStudentFLights(studentId: number, offset: number | undefined = undefined, limit = 20) {
    if (!offset && this.paginator) {
      this.paginator.pageIndex = 0;
    }

    this.studentService.getFlightsByStudentId({ limit, offset }, studentId).pipe(takeUntil(this.unsubscribe$)).subscribe((pagerEntity: PagerEntity<Flight[]>) => {
      this.flightPagerEntity = pagerEntity;
      if (pagerEntity.entity) {
        this.flights = pagerEntity.entity;
      }
    });
  }

  handleFlightPage(event: any) {
    let offset = event.pageIndex * event.pageSize;
    if (this.student?.id) {
      this.loadStudentFLights(this.student?.id, offset, event.pageSize);
    }
  }

  saveControlSheet(controlSheet?: ControlSheet) {
    if (!this.student?.id || !controlSheet) {
      return;
    }
    this.studentService.postControlSheetByStudentId(this.student?.id, controlSheet).pipe(takeUntil(this.unsubscribe$)).subscribe((controlSheet: ControlSheet) => {
      this.student!.controlSheet = controlSheet;
    });
  }

  backButton() {
    this.backButtonClick.emit();
  }

  async archiveStudent() {
    if (!this.student?.id) {
      return;
    }

    const studentName = `${this.student?.user?.firstname} ${this.student?.user?.lastname}`;
    const dialogRef = this.dialog.open(ArchiveStudentDialogComponent, {
      data: {
        studentName: studentName
      },
      width: "500px"
    });

    dialogRef.afterClosed().subscribe(async (response) => {
      if (response?.event === "confirm" && this.student?.id) {
        await firstValueFrom(this.studentService.archiveStudent(this.student.id));
        await firstValueFrom(this.studentService.changeStudentAppointmentAccess(this.student, response.isAppointmentActive));
        this.removeUserButtonClick.emit("deleted");
      }
    });
  }

  async printFlightbook() {
    if (!this.student?.user) {
      return;
    }

    if (this.flights.length == 0) {
      this.snackBar.open(this.translate.instant('message.noFlight'), this.translate.instant('buttons.done'), {
        horizontalPosition: 'center',
        verticalPosition: 'top',
      });
      return;
    }

    const flights = await firstValueFrom(this.studentService.getFlightsByStudentId({ limit: 2000 }, this.student?.id!))

    if (this.school?.configuration?.schoolModule?.validateFlights) {
      flights.entity = flights.entity!.filter((flight: Flight) => flight.validation?.state == FlightValidationState.VALIDATED);
    }
    // We revert to have the oldest flight at position 1
    flights.entity = flights.entity?.reverse();
    this.pdfExportService.generatePdf(flights.entity!, this.student?.user);
  }

  changeAloneValue(flight: Flight) {
    this.studentService.putFlightByStudentId(this.student?.id!, flight).pipe(takeUntil(this.unsubscribe$)).subscribe((flight: Flight) => {
      if (flight.shvAlone) {
        if (!this.student!.statistic!.nbFlightsAlone) {
          this.student!.statistic!.nbFlightsAlone = 0;
        }
        this.student!.statistic!.nbFlightsAlone++;
      } else if (this.student?.statistic?.nbFlightsAlone) {
        this.student!.statistic!.nbFlightsAlone--;
      }
      
      this.snackBar.open(this.translate.instant('message.changeSaved'), this.translate.instant('buttons.done'), {
        horizontalPosition: 'center',
        verticalPosition: 'top',
        duration: 2000
      });
    });
  }

  validateFlight(flight: Flight) {
    flight.validation = {
      state: FlightValidationState.VALIDATED
    }
    this.changeValidationValue(flight);
  }

  rejectFlight(flight: Flight) {
    this.flightToReject = flight;
    this.rejectComment = '';
    this.showRejectCommentBox = true;
  }

  submitRejectComment() {
    if (this.flightToReject) {
      this.flightToReject.validation = {
        state: FlightValidationState.REJECTED,
        comment: this.rejectComment != '' ? this.rejectComment : undefined
      };
      this.changeValidationValue(this.flightToReject);
    }
    this.closeRejectCommentBox();
  }

  closeRejectCommentBox() {
    this.showRejectCommentBox = false;
    this.rejectComment = '';
    this.flightToReject = null;
  }

  private changeValidationValue(flight: Flight) {
    this.studentService.validateFlightSchoolIdAndStudentId(this.student?.id!, this.school?.id!, flight).pipe(takeUntil(this.unsubscribe$)).subscribe((updatedFlight: Flight) => {
      flight.validation = updatedFlight.validation;
      this.snackBar.open(this.translate.instant('message.changeSaved'), this.translate.instant('buttons.done'), {
        horizontalPosition: 'center',
        verticalPosition: 'top',
        duration: 2000
      });
      this.validateFlightsButtonClick.emit("validated");
    });
  }

  validateAllFlights() {
    this.studentService.validateAllFlightsBySchoolIdAndStudentId(this.student?.id!, this.school?.id!).pipe(takeUntil(this.unsubscribe$)).subscribe(() => {
      this.loadStudentFLights(this.student?.id!);
      this.snackBar.open(this.translate.instant('message.changeSaved'), this.translate.instant('buttons.done'), {
        horizontalPosition: 'center',
        verticalPosition: 'top',
        duration: 2000
      });
      this.validateFlightsButtonClick.emit("validatedAll");
    });
  }

  /**
   * Checks if a flight is validated
   */
  isFlightValidated(flight: Flight): boolean {
    if (!flight.validation) {
      return false;
    }
    if (flight.validation.state === FlightValidationState.REJECTED ||
      flight.validation.state === FlightValidationState.VALIDATED) {
      return true;
    }
    return false;
  }

  async changeStudentIsTandem(event: MatSlideToggleChange) {
    if (this.student) {
      this.student.isTandem = event.checked;
      await firstValueFrom(this.studentService.tandemStudent(this.student));
    }
  }

  async changeStudentIsAppointmentActive(event: MatSlideToggleChange) {
    if (this.student) {
      await firstValueFrom(this.studentService.changeStudentAppointmentAccess(this.student, event.checked));
    }
  }
}
