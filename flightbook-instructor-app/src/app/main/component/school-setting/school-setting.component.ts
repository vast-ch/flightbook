import { ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, OnInit, Output, Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { AccountService } from 'src/app/core/services/account.service';
import { DeviceSizeService } from 'src/app/core/services/device-size.service';
import { SchoolService } from 'src/app/core/services/school.service';
import { School } from 'src/app/shared/domain/school';
import { firstValueFrom } from 'rxjs';
import { SchoolConfig } from 'src/app/shared/domain/school-config';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'fb-school-setting',
  templateUrl: './school-setting.component.html',
  styleUrl: './school-setting.component.scss',
  standalone: false
})
export class SchoolSettingComponent implements OnInit {
  @Output() backButtonClick = new EventEmitter();
  school?: School;
  googleCalendarConnected = false;
  googleCalendarLoading = false;
  availableCalendars: Array<{ id: string; summary: string; primary: boolean }> = [];
  selectedCalendarId = '';
  showCalendarSelector = false;
  private destroyRef = inject(DestroyRef);
  settings = [
    { type: 'validateFlights' },
    { type: 'googleCalendar' }
  ];

  constructor(
    private deviceSize: DeviceSizeService,
    private schoolService: SchoolService,
    private accountService: AccountService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    this.school = this.accountService.currentSelectedSchool;
  }

  async ngOnInit() {
    await this.checkGoogleCalendarStatus();
    this.handleOAuthCallback();
    
    // Subscribe to school changes to refresh status
    this.accountService.changeSelectedSchool$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async (school: School) => {
      this.school = school;
      await this.checkGoogleCalendarStatus();
    });
  }

  get isMobile(): Signal<boolean> {
    return this.deviceSize.isMobile;
  }

  backButton() {
    this.backButtonClick.emit();
  }

  async changeValidateFlights(event: MatSlideToggleChange) {
    if (!this.school?.configuration) {
      this.school!.configuration = new SchoolConfig();
    }
    this.school!.configuration.schoolModule!.validateFlights = event.checked;
    this.updateConfiguration();
  }

  async updateConfiguration() {
    if (this.school?.id) {
      await firstValueFrom(this.schoolService.updateSchoolConfiguration(this.school?.id, this.school!.configuration!));
    }
  }

  async checkGoogleCalendarStatus() {
    if (this.school?.id) {
      try {
        const status = await firstValueFrom(this.schoolService.getGoogleCalendarStatus(this.school.id));
        this.googleCalendarConnected = status.connected;
        
        if (status.connected) {
          await this.loadAvailableCalendars();
        }
      } catch (error) {
        console.error('Failed to check Google Calendar status:', error);
      }
    }
  }

  async loadAvailableCalendars() {
    if (!this.school?.id) return;
    
    try {
      this.availableCalendars = await firstValueFrom(this.schoolService.getAvailableCalendars(this.school.id));
      
      const configuredCalendarId = this.school.configuration?.googleCalendar?.calendarId;
      
      if (configuredCalendarId && configuredCalendarId !== 'primary') {
        this.selectedCalendarId = configuredCalendarId;
      } else {
        const primaryCalendar = this.availableCalendars.find(cal => cal.primary);
        this.selectedCalendarId = primaryCalendar?.id || this.availableCalendars[0]?.id || 'primary';
        
        if (this.selectedCalendarId && this.selectedCalendarId !== 'primary') {
          await firstValueFrom(this.schoolService.updateGoogleCalendar(this.school.id, this.selectedCalendarId));
        }
      }
      
      this.cdr.detectChanges();
    } catch (error: any) {
      if (error?.error?.message === 'GOOGLE_CALENDAR_TOKEN_EXPIRED') {
        this.googleCalendarConnected = false;
        this.availableCalendars = [];
      }
    }
  }

  async onCalendarChange() {
    if (!this.school?.id) return;
    
    this.googleCalendarLoading = true;
    try {
      await firstValueFrom(this.schoolService.updateGoogleCalendar(this.school.id, this.selectedCalendarId));
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
    if (!this.school?.id) return;
    
    this.googleCalendarLoading = true;
    try {
      await firstValueFrom(this.schoolService.disconnectGoogleCalendar(this.school.id));
      this.googleCalendarConnected = false;
    } catch (error) {
      console.error('Failed to disconnect Google Calendar:', error);
    } finally {
      this.googleCalendarLoading = false;
    }
  }

  private handleOAuthCallback() {
    // Check parent route query params (configuration route)
    this.route.parent?.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
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
