import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
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
  displayedColumns: string[] = ['edit', 'subscription', 'list', 'scheduling', 'state', 'meetingPoint', 'instructor', 'takeOffCoordinator', 'countSubscription', 'countGuestSubscription', 'countWaitinglist'];
  pagerEntity = new PagerEntity<Appointment[]>;
  states = State;
  currentAppointmentFilter: AppointmentFilter;

  // List/calendar toggle (replaces the old List/Calendar mat-tab-group) - see toggleCalendarView().
  appointmentView: 'list' | 'calendar' = 'list';
  // Upcoming/Past tablist - see selectTab().
  appointmentTab: 'upcoming' | 'past' = 'upcoming';
  upcomingCount = 0;
  pastCount = 0;

  @ViewChild('paginator') paginator: MatPaginator | undefined;
  @ViewChild('calendar') calendarComponent: FullCalendarComponent | undefined;
  @ViewChild('draggableEvents') draggableEvents: ElementRef | undefined;
  @ViewChildren('tabButton') tabButtons: QueryList<ElementRef<HTMLButtonElement>> | undefined;
  calendarApi: Calendar | undefined;
  draggable: any;

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
      this.selectTab('upcoming');

      this.schoolService.getTeamMembers(this.school.id).pipe(takeUntil(this.unsubscribe$)).subscribe((teamMembers: TeamMember[]) => {
        this.teamMembers = teamMembers;
      })

      this.schoolService.getStudentsBySchoolId(this.school.id, false).pipe(takeUntil(this.unsubscribe$)).subscribe((students: Student[]) => {
        this.students = students.sort(((obj1, obj2) => (obj1.user?.firstname && obj2.user?.firstname && obj1.user?.firstname > obj2.user?.firstname ? 1 : -1)));
      })

      this.schoolService.getAppointmentTypesBySchoolId(this.school.id, { archived: false }).pipe(takeUntil(this.unsubscribe$)).subscribe((appointmentTypes: AppointmentType[]) => {
        this.appointmentTypes = appointmentTypes;
        // 'type' is a conditional column - remove it if present, then re-insert right after
        // 'state' when there is at least one appointment type. Index-based find/remove/insert
        // (rather than the old length===12 splice(-1) check) so this stays correct however
        // many times initialLoad() re-runs (school switch) and regardless of column order.
        const typeIndex = this.displayedColumns.indexOf('type');
        if (typeIndex !== -1) {
          this.displayedColumns.splice(typeIndex, 1);
        }
        if (appointmentTypes.length > 0) {
          const stateIndex = this.displayedColumns.indexOf('state');
          this.displayedColumns.splice(stateIndex + 1, 0, 'type');
        }
        if (this.appointmentView === 'calendar') {
          this.initializeDraggable();
        }
      });

      this.refreshTabCounts();
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
          this.refreshTabCounts();
        })
      } else if (response?.event === "save" && this.school?.id && type == "update") {
        const schoolId = this.school.id;
        this.schoolService.putAppointment(schoolId, response.appointment).pipe(takeUntil(this.unsubscribe$)).subscribe((appointment: Appointment) => {
          this.loadAppointments(schoolId);
          this.refreshTabCounts();
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
    this.refreshTabCounts();
  }

  get selectedInstructorLabel(): string {
    const instructorId = this.currentAppointmentFilter.instructorId;
    if (!instructorId) {
      return this.translate.instant('appointment.allInstructors');
    }
    const teamMember = this.teamMembers.find((teamMember: TeamMember) => teamMember.user.id === instructorId);
    return teamMember ? `${teamMember.user.firstname} ${teamMember.user.lastname}` : this.translate.instant('appointment.allInstructors');
  }

  /** Upcoming = filter.from = today (ascending); Past = filter.to = today (descending). The
   *  sort direction is resolved server-side (AppointmentRepository's new `order` param) rather
   *  than by sorting the fetched page client-side, since the backend paginates before any
   *  client-side sort could run - a client-side re-sort alone would select the wrong window of
   *  rows once there are more matching rows than one page. */
  selectTab(tab: 'upcoming' | 'past') {
    this.appointmentTab = tab;
    const today = moment().utc().startOf('day').toDate();
    if (tab === 'upcoming') {
      this.currentAppointmentFilter.from = today;
      this.currentAppointmentFilter.to = undefined;
      this.currentAppointmentFilter.order = 'ASC';
    } else {
      this.currentAppointmentFilter.from = undefined;
      this.currentAppointmentFilter.to = today;
      this.currentAppointmentFilter.order = 'DESC';
    }
    this.schoolService.filter = this.currentAppointmentFilter;
    // Matches the paginator's fixed [pageSizeOptions]="[20]" (decision #9) - the old 10/20/50
    // selector is gone, so the requested page size must always be 20 in list view.
    this.schoolService.limit = 20;
    if (this.school?.id) {
      this.loadAppointments(this.school.id);
    }
  }

  /** WAI-ARIA APG tabs pattern, mirrored from students.component.ts's onTabKeydown: Left/Right
   *  (with wrap-around) and Home/End move focus and select the tab, keeping the tablist a
   *  single Tab stop (roving tabindex in the template). */
  onTabKeydown(event: KeyboardEvent): void {
    const tabs: Array<'upcoming' | 'past'> = ['upcoming', 'past'];
    const buttons = this.tabButtons?.toArray();
    if (!buttons || buttons.length === 0) {
      return;
    }

    const count = buttons.length;
    const currentIndex = tabs.indexOf(this.appointmentTab);
    let newIndex: number;
    switch (event.key) {
      case 'ArrowLeft':
        newIndex = (currentIndex - 1 + count) % count;
        break;
      case 'ArrowRight':
        newIndex = (currentIndex + 1) % count;
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
    this.selectTab(tabs[newIndex]);
    buttons[newIndex].nativeElement.focus();
  }

  /** Capacity dot-matrix for the registrations cell: one dot per seat (maxPeople), filled for
   *  each existing registration, all filled dots turned 'over' (danger) once at/over capacity.
   *  Guard: no maxPeople means no dots, just the plain count (mirrors the existing
   *  @if (element.maxPeople) guard around the "/maxPeople" suffix). */
  getRegistrationCells(appointment: Appointment): Array<'filled' | 'over' | 'empty'> {
    if (!appointment.maxPeople) {
      return [];
    }
    const count = appointment.countSubscription || 0;
    const max = appointment.maxPeople;
    const overCapacity = count >= max;
    const cells: Array<'filled' | 'over' | 'empty'> = [];
    for (let i = 0; i < max; i++) {
      if (i < count) {
        cells.push(overCapacity ? 'over' : 'filled');
      } else {
        cells.push('empty');
      }
    }
    return cells;
  }

  /** Toggles between the redesigned Upcoming/Past list and the existing FullCalendar view,
   *  replacing the old List/Calendar mat-tab-group (decision #1). The active-state affordance
   *  and the icon swap (calendar_month <-> format_list_bulleted) are this implementation's own
   *  addition - the mockup only shows an unwired calendar-icon button. */
  toggleCalendarView() {
    if (this.appointmentView === 'list') {
      this.appointmentView = 'calendar';
      // No leftover tab-scoped sort direction for monthNavigation()'s own date-range fetch.
      this.schoolService.filter.order = undefined;
      if (this.appointmentTypes.length > 0) {
        this.initializeDraggable();
      }
    } else {
      this.appointmentView = 'list';
      // Destroy draggable when leaving calendar view since DOM will be recreated
      if (this.draggable) {
        this.draggable.destroy();
        this.draggable = null;
      }
      // Re-apply the currently selected tab's date filter/order and re-fetch - unlike the old
      // code's bare filter reset (there was no list-tab concept to return to before), leaving
      // the filter empty here would show an unfiltered, wrongly-sorted list.
      this.selectTab(this.appointmentTab);
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

  /** Tab counts (decision #4): refreshed on school load, on instructor-filter change, and
   *  after an appointment is added/edited. Deliberately NOT refreshed on state-chip toggle or
   *  tab switch - those counts must stay stable across those interactions. Uses
   *  SchoolService.getAppointmentCount(), which is independent of the shared mutable
   *  `this.filter` so it can't race the main list fetch's own from/to/order. */
  private refreshTabCounts(): void {
    if (!this.school?.id) {
      return;
    }
    const schoolId = this.school.id;
    const today = moment().utc().startOf('day').toDate();
    const instructorId = this.currentAppointmentFilter.instructorId;
    this.schoolService.getAppointmentCount(schoolId, { from: today, instructorId }).pipe(takeUntil(this.unsubscribe$)).subscribe((count: number) => {
      this.upcomingCount = count;
    });
    this.schoolService.getAppointmentCount(schoolId, { to: today, instructorId }).pipe(takeUntil(this.unsubscribe$)).subscribe((count: number) => {
      this.pastCount = count;
    });
  }

}
