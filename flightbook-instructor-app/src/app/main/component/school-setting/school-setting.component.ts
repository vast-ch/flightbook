import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { AccountService } from 'src/app/core/services/account.service';
import { SchoolService } from 'src/app/core/services/school.service';
import { School } from 'src/app/shared/domain/school';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { SchoolConfig, SchoolModule } from 'src/app/shared/domain/school-config';

@Component({
  selector: 'fb-school-setting',
  templateUrl: './school-setting.component.html',
  styleUrl: './school-setting.component.scss',
  standalone: false
})
export class SchoolSettingComponent implements OnInit, OnDestroy {
  school?: School;
  googleCalendarConnected = false;
  googleCalendarLoading = false;
  availableCalendars: Array<{ id: string; summary: string; primary: boolean }> = [];
  selectedCalendarId = '';
  calendarChecked = false;
  calendarsLoaded = false;
  // Latest request wins: every await below re-checks this, so a school switch abandons whatever
  // was in flight and one school's calendars can never be combined with another's config.
  private calendarRequest = 0;
  private destroyed = false;
  unsubscribe$ = new Subject<void>();

  constructor(
    private schoolService: SchoolService,
    private accountService: AccountService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    this.school = this.accountService.currentSelectedSchool;
  }

  ngOnInit() {
    // Subscribe to school changes to refresh status
    this.accountService.changeSelectedSchool$.pipe(takeUntil(this.unsubscribe$)).subscribe((school: School) => {
      this.school = school;
      this.resetCalendarState();
      this.checkGoogleCalendarStatus();
    });
    this.handleOAuthCallback();
    this.checkGoogleCalendarStatus();
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.calendarRequest++;
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  async changeValidateFlights(event: MatSlideToggleChange) {
    if (this.school) {
      this.ensureSchoolModule(this.school).validateFlights = event.checked;
      this.updateConfiguration();
    }
  }

  async changeCommentsOnSubscription(event: MatSlideToggleChange) {
    if (this.school) {
      this.ensureSchoolModule(this.school).commentsOnSubscription = event.checked;
      this.updateConfiguration();
    }
  }

  async updateConfiguration() {
    if (this.school?.id) {
      await firstValueFrom(this.schoolService.updateSchoolConfiguration(this.school.id, { schoolModule: this.school.configuration?.schoolModule }));
    }
  }

  async checkGoogleCalendarStatus() {
    const school = this.school;
    if (!school?.id) return;

    const request = ++this.calendarRequest;
    try {
      const status = await firstValueFrom(this.schoolService.getGoogleCalendarStatus(school.id));
      if (request !== this.calendarRequest) return;

      this.googleCalendarConnected = status.connected;
      this.calendarChecked = true;

      if (status.connected) {
        await this.loadAvailableCalendars(school, request);
      }
    } catch (error) {
      if (request !== this.calendarRequest) return;

      this.calendarChecked = true;
      console.error('Failed to check Google Calendar status:', error);
    }
  }

  private async loadAvailableCalendars(school: School, request: number) {
    try {
      const calendars = await firstValueFrom(this.schoolService.getAvailableCalendars(school.id!));
      if (request !== this.calendarRequest) return;

      this.availableCalendars = calendars;
      const configuredCalendarId = school.configuration?.googleCalendar?.calendarId;

      if (configuredCalendarId && configuredCalendarId !== 'primary') {
        this.selectedCalendarId = configuredCalendarId;
      } else {
        const primaryCalendar = this.availableCalendars.find(cal => cal.primary);
        const calendarId = primaryCalendar?.id || this.availableCalendars[0]?.id || 'primary';
        this.selectedCalendarId = calendarId;

        if (calendarId !== 'primary') {
          await firstValueFrom(this.schoolService.updateGoogleCalendar(school.id!, calendarId));
          this.rememberCalendar(school, calendarId);
          if (request !== this.calendarRequest) return;
        }
      }

      this.calendarsLoaded = true;
      this.cdr.detectChanges();
    } catch (error: any) {
      if (request !== this.calendarRequest) return;

      if (error?.error?.message === 'GOOGLE_CALENDAR_TOKEN_EXPIRED') {
        this.googleCalendarConnected = false;
        this.availableCalendars = [];
      }
    }
  }

  async onCalendarChange() {
    const school = this.school;
    if (!school?.id) return;

    const calendarId = this.selectedCalendarId;
    this.googleCalendarLoading = true;
    try {
      await firstValueFrom(this.schoolService.updateGoogleCalendar(school.id, calendarId));
      this.rememberCalendar(school, calendarId);
    } catch (error) {
      console.error('Failed to update calendar selection:', error);
    } finally {
      this.googleCalendarLoading = false;
    }
  }

  async connectGoogleCalendar() {
    if (!this.school?.id) return;
    
    this.googleCalendarLoading = true;
    try {
      const response = await firstValueFrom(this.schoolService.getGoogleCalendarAuthUrl(this.school.id));
      window.location.href = response.authUrl;
    } catch (error) {
      console.error('Failed to get Google Calendar auth URL:', error);
      this.googleCalendarLoading = false;
    }
  }

  async disconnectGoogleCalendar() {
    const school = this.school;
    if (!school?.id) return;

    this.calendarRequest++;
    this.googleCalendarLoading = true;
    try {
      await firstValueFrom(this.schoolService.disconnectGoogleCalendar(school.id));
      if (school.configuration) {
        school.configuration.googleCalendar = undefined;
      }
      if (school === this.school) {
        this.resetCalendarState();
        this.calendarChecked = true;
      }
    } catch (error) {
      console.error('Failed to disconnect Google Calendar:', error);
      // calendarRequest++ above abandoned any pending check, so the card would stay half loaded.
      if (school === this.school && !this.destroyed) {
        this.checkGoogleCalendarStatus();
      }
    } finally {
      this.googleCalendarLoading = false;
    }
  }

  private resetCalendarState() {
    this.calendarRequest++;
    this.googleCalendarConnected = false;
    this.calendarChecked = false;
    this.calendarsLoaded = false;
    this.availableCalendars = [];
    this.selectedCalendarId = '';
  }

  /** Supplies every field the API requires of a new module, so a missing one saves, not 400s. */
  private ensureSchoolModule(school: School): SchoolModule {
    const configuration = (school.configuration ??= new SchoolConfig());
    return (configuration.schoolModule ??= {
      active: true,
      validateFlights: false,
      userCanEditControlSheet: true,
      commentsOnSubscription: false,
    });
  }

  /** Keeps the cached school in step, so the auto-default PUT does not repeat on every page open. */
  private rememberCalendar(school: School, calendarId: string) {
    const configuration = (school.configuration ??= new SchoolConfig());
    configuration.googleCalendar = { ...configuration.googleCalendar, calendarId };
  }

  private handleOAuthCallback() {
    // Check parent route query params (configuration route)
    this.route.parent?.queryParams.pipe(takeUntil(this.unsubscribe$)).subscribe(params => {
      if (params['google_calendar']) {
        if (params['google_calendar'] === 'success') {
          // Refresh status after successful OAuth
          this.checkGoogleCalendarStatus();
        } else if (params['google_calendar'] === 'error') {
          console.error('Google Calendar connection failed:', params['message']);
        }
      }
    });
  }
}
