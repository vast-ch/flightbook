import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { AccountService } from 'src/app/core/services/account.service';
import { SchoolService } from 'src/app/core/services/school.service';
import { StudentListPDFService } from 'src/app/core/services/student-list-pdf.service';
import { Appointment } from 'src/app/shared/domain/appointment';
import { AppointmentFilter } from 'src/app/shared/domain/appointment-filter';
import { AppointmentType } from 'src/app/shared/domain/appointment-type-dto';
import { PagerEntity } from 'src/app/shared/domain/pagerEntity';
import { School } from 'src/app/shared/domain/school';
import { State } from 'src/app/shared/domain/state';
import { Student } from 'src/app/shared/domain/student';
import { TeamMember } from 'src/app/shared/domain/team-member';
import { AppointmentFormDialogComponent } from '../../component/appointment-form-dialog/appointment-form-dialog.component';
import { SubscriptionsComponent } from '../../component/subscriptions/subscriptions.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { DatePipe } from '@angular/common';
import { Calendar, CalendarOptions, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { FullCalendarComponent } from '@fullcalendar/angular';
import interactionPlugin, { Draggable, EventReceiveArg } from '@fullcalendar/interaction';
import moment from 'moment';
import { MatTabChangeEvent } from '@angular/material/tabs';
import { Subscription } from 'src/app/shared/domain/subscription';

@Component({
    selector: 'app-appointments',
    templateUrl: './appointments.component.html',
    styleUrls: ['./appointments.component.scss'],
    standalone: false
})
export class AppointmentsComponent implements OnInit, OnDestroy, AfterViewInit {

  unsubscribe$ = new Subject<void>();
  school: School | undefined;
  appointments: Appointment[];
  appointmentTypes: AppointmentType[] = [];
  teamMembers: TeamMember[] = [];
  students: Student[] = [];
  displayedColumns: string[] = ['edit', 'subscription', 'list', 'scheduling', 'state', 'meetingPoint', 'instructor', 'takeOffCoordinator', 'countSubscription', 'countGuestSubscription', 'countWaitinglist', 'type'];
  pagerEntity = new PagerEntity<Appointment[]>;
  states = State;
  currentAppointmentFilter: AppointmentFilter;
  showAdvancedFilters = false;
  @ViewChild('paginator') paginator: MatPaginator | undefined;
  @ViewChild('calendar') calendarComponent: FullCalendarComponent | undefined;
  @ViewChild('draggableEvents') draggableEvents: ElementRef | undefined;
  calendarApi: Calendar | undefined;
  draggable: any;
  isCalendarTabActive = false;

  datePipe: DatePipe;
  calendarOptions: CalendarOptions = {
    height: 'auto',
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, interactionPlugin],
    eventClick: (arg) => this.handleCalendarEventClick(arg),
    events: [],
    droppable: true,
    timeZone: 'UTC',
    eventReceive: this.handleEventReceive.bind(this),
    datesSet: this.monthNavigation.bind(this)
  };

  constructor(
    private schoolService: SchoolService,
    private accountService: AccountService,
    private studentListPDFService: StudentListPDFService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentAppointmentFilter = this.schoolService.filter;
    this.appointments = [];
    this.datePipe = new DatePipe('en-US');
    this.calendarOptions.locale = this.translate.currentLang;
    this.calendarOptions.buttonText = {
      today: this.translate.instant('fullcalendar.today')
    };
  }

  ngOnInit(): void {
    this.school = this.accountService.currentSelectedSchool;
    if (this.school) {
      this.initialLoad();
    }
    this.accountService.changeSelectedSchool$.pipe(takeUntil(this.unsubscribe$)).subscribe((school: School) => {
      this.school = school;
      this.appointmentTypes = [];
      this.initialLoad();
    });
  }

  ngAfterViewInit() {
    this.calendarApi = this.calendarComponent?.getApi();
  }

  initialLoad() {
    if (this.school?.id) {
      this.loadAppointments(this.school.id);

      this.schoolService.getTeamMembers(this.school.id).pipe(takeUntil(this.unsubscribe$)).subscribe((teamMembers: TeamMember[]) => {
        this.teamMembers = teamMembers;
      })

      this.schoolService.getStudentsBySchoolId(this.school.id, false).pipe(takeUntil(this.unsubscribe$)).subscribe((students: Student[]) => {
        this.students = students.sort(((obj1, obj2) => (obj1.user?.firstname && obj2.user?.firstname && obj1.user?.firstname > obj2.user?.firstname ? 1 : -1)));
      })

      this.schoolService.getAppointmentTypesBySchoolId(this.school.id, { archived: false }).pipe(takeUntil(this.unsubscribe$)).subscribe((appointmentTypes: AppointmentType[]) => {
        this.appointmentTypes = appointmentTypes;
        if (this.displayedColumns.length == 12) {
          this.displayedColumns.splice(-1);
        }
        if (appointmentTypes.length > 0) {
          this.displayedColumns.push('type');
        }
        if (this.isCalendarTabActive) {
          this.initializeDraggable();
        }
      });
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
    this.draggable?.destroy();
  }

  loadAppointments(schoolId: number, offset: number | undefined = undefined, limit = this.schoolService.limit) {
    if (!offset && this.paginator) {
      this.paginator.pageIndex = 0;
    }
    this.schoolService.getAppointmentsBySchoolId({ limit, offset }, schoolId).pipe(takeUntil(this.unsubscribe$)).subscribe({
      next: (pagerEntity: PagerEntity<Appointment[]>) => {
        this.pagerEntity = pagerEntity;
        if (pagerEntity.entity) {
          this.appointments = pagerEntity.entity;
          const events: any[] = [];
          this.appointments.forEach((appointment: Appointment) => {
            if (appointment.scheduling) {
              events.push({
                id: appointment.id?.toString(),
                title: appointment.type ? appointment.type.name : '-',
                date: moment(appointment.scheduling).format('YYYY-MM-DD'),
                color: appointment.type?.color || 'rgb(56, 128, 255)'
              });
            }
          });
          this.calendarOptions.events = events;
        }
      }
    })
  }

  editAppointment(appointment: Appointment) {
    this.handleAppointmentDialog(appointment, "update");
  }

  addAppointment() {
    const appointment = new Appointment();
    appointment.state = State.ANNOUNCED;
    appointment.scheduling = moment().utc().hours(8).minutes(0).seconds(0).millisecond(0).toDate();
    this.handleAppointmentDialog(appointment, "add");
  }

  handleAppointmentDialog(appointment: Appointment, type: string) {
    const dialogRef = this.dialog.open(AppointmentFormDialogComponent, {
      width: "700px",
      data: {
        teamMembers: this.teamMembers,
        students: this.students,
        appointment: appointment,
        appointmentTypes: this.appointmentTypes
      }
    });

    dialogRef.afterClosed().subscribe(response => {
      if (response?.event === "save" && this.school?.id && type == "add") {
        const schoolId = this.school.id;
        this.schoolService.postAppointment(schoolId, response.appointment).pipe(takeUntil(this.unsubscribe$)).subscribe((appointment: Appointment) => {
          this.loadAppointments(schoolId);
        })
      } else if (response?.event === "save" && this.school?.id && type == "update") {
        const schoolId = this.school.id;
        this.schoolService.putAppointment(schoolId, response.appointment).pipe(takeUntil(this.unsubscribe$)).subscribe((appointment: Appointment) => {
          this.loadAppointments(schoolId);
        })
      }
    });
  }

  subscriptionDetail(appointment: Appointment) {
    const dialogRef = this.dialog.open(SubscriptionsComponent, {
      width: "700px",
      data: {
        appointment: appointment
      }
    });
  }

  async printStudentList(appointment: Appointment) {
    if (!this.school?.id || !appointment.id) {
      return;
    }

    let students = await firstValueFrom(this.schoolService.getSubscriptionStudentDetail(this.school.id, appointment.id));
    appointment.subscriptions.forEach((subscription: Subscription) => {
      const studentIndex = students.findIndex((student: Student) => student.id == subscription.student?.id && subscription.waitingList);
      if (studentIndex !== -1) {
        students.splice(studentIndex, 1);
      }
    });
    try {
      const pdf = await this.studentListPDFService.generatePdf_V2(students, this.school, appointment);
      pdf.open();
    } catch (error: any) {
      const pdf = await this.studentListPDFService.generatePdf_V2(students, this.school, appointment);
      pdf.download(`${this.datePipe.transform(appointment.scheduling, 'yyyy.MM.dd')}-registrations.pdf`);
      this.snackBar.open(this.translate.instant('message.pdfDownloaded'), this.translate.instant('buttons.done'), {
        horizontalPosition: 'center',
        verticalPosition: 'top',
      });
    }
  }

  handlePage(event: any) {
    let offset = event.pageIndex * event.pageSize;
    if (this.school?.id) {
      this.loadAppointments(this.school.id, offset, event.pageSize);
    }
  }

  changeState(state: State) {
    if (this.currentAppointmentFilter.state == state) {
      this.currentAppointmentFilter.state = undefined;
    } else {
      this.currentAppointmentFilter.state = state;
    }
    this.schoolService.filter = this.currentAppointmentFilter;
    if (this.school?.id) {
      this.loadAppointments(this.school.id);
    }
  }

  changeInstructor(newInstructorId: any) {
    this.currentAppointmentFilter.instructorId = newInstructorId;
    this.schoolService.filter = this.currentAppointmentFilter;
    if (this.school?.id) {
      this.loadAppointments(this.school.id);
    }
  }

  toggleAdvancedFilters() {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }

  tabChanged(tabChangeEvent: MatTabChangeEvent) {
    if (tabChangeEvent.index === 1) {
      this.isCalendarTabActive = true;
      if (this.appointmentTypes.length > 0) {
        this.initializeDraggable();
      }
    } else {
      this.isCalendarTabActive = false;
      // Destroy draggable when leaving calendar tab since DOM will be recreated
      if (this.draggable) {
        this.draggable.destroy();
        this.draggable = null;
      }
      if (!this.school?.id) {
        return;
      }
      this.schoolService.filter.from = undefined;
      this.schoolService.filter.to = undefined;
      this.schoolService.limit = 10;
      this.loadAppointments(this.school?.id);
    }
  }

  initializeDraggable() {
    // Destroy existing instance if it exists
    if (this.draggable) {
      this.draggable.destroy();
      this.draggable = null;
    }

    // Use requestAnimationFrame to wait for the next render cycle
    requestAnimationFrame(() => {
      this.cdr.detectChanges();
      
      // Try to get the element, if not available, use MutationObserver
      const draggableEl = document.getElementById('draggable-events');
      if (draggableEl) {
        this.createDraggable(draggableEl);
      } else {
        // Element not yet in DOM, observe for it
        this.observeForDraggableElement();
      }
    });
  }

  private observeForDraggableElement() {
    const observer = new MutationObserver((mutations, obs) => {
      const draggableEl = document.getElementById('draggable-events');
      if (draggableEl) {
        this.createDraggable(draggableEl);
        obs.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Disconnect after 5 seconds to prevent memory leaks
    setTimeout(() => observer.disconnect(), 5000);
  }

  private createDraggable(element: HTMLElement) {
    this.draggable = new Draggable(element, {
      itemSelector: '.draggable-event-item',
      eventData: function (eventEl) {
        return {
          title: eventEl.innerText
        };
      }
    });
  }

  handleCalendarEventClick(arg: EventClickArg) {
    const selectedAppointment = this.appointments.find((appointment: Appointment) => appointment.id == parseInt(arg.event.id));
    if (selectedAppointment) {
      this.editAppointment(selectedAppointment);
    }
  }

  handleEventReceive(arg: EventReceiveArg) {
    if (!arg.event.start || !this.school?.id) {
      return;
    }

    const schoolId = this.school.id;
    const appointment = new Appointment();
    const schedulingMoment = moment(arg.event.start).utc().hours(8).minutes(0).seconds(0).millisecond(0);
    appointment.state = State.ANNOUNCED;
    appointment.type = this.appointmentTypes.find((appointmentType: AppointmentType) => appointmentType.name == arg.event.title);
    appointment.meetingPoint = appointment.type?.meetingPoint;
    appointment.maxPeople = appointment.type?.maxPeople;
    appointment.instructor = appointment.type?.instructor;
    if (appointment.type?.time) {
      const [hours, minutes] = appointment.type.time.split(':');
      schedulingMoment.hours(parseInt(hours)).minutes(parseInt(minutes));
    }

    if (appointment.type?.deadlineOffsetHours) {
      const deadline = schedulingMoment.clone();
      deadline.subtract(appointment.type.deadlineOffsetHours, 'hours');
      appointment.deadline = deadline.toDate();
    }
    
    appointment.scheduling = schedulingMoment.toDate();
    this.schoolService.postAppointment(schoolId, appointment).pipe(takeUntil(this.unsubscribe$)).subscribe((appointment: Appointment) => {
      this.loadAppointments(schoolId);
    });
  }

  monthNavigation(arg: any) {
    if (!this.school?.id) {
      return;
    }

    this.schoolService.limit = 400;
    this.schoolService.filter.from = moment(arg.start).utc().toDate();
    this.schoolService.filter.to = moment(arg.end).utc().toDate();
    this.loadAppointments(this.school?.id);
  }

}
