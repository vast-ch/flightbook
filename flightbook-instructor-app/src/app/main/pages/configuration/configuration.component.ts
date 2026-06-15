import { Component, effect, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { DeviceSizeService } from 'src/app/core/services/device-size.service';
import { AccountService } from 'src/app/core/services/account.service';
import { School } from 'src/app/shared/domain/school';

@Component({
    selector: 'app-configuration',
    templateUrl: './configuration.component.html',
    styleUrls: ['./configuration.component.scss'],
    standalone: false
})
export class ConfigurationComponent implements OnInit, OnDestroy {

  @ViewChild(MatSidenav) sidenav: MatSidenav | undefined;
  type = "team";
  school?: School;
  unsubscribe$ = new Subject<void>();

  constructor(
    private deviceSize: DeviceSizeService,
    private route: ActivatedRoute,
    private accountService: AccountService
  ) {
    effect(() => {
      if ((!this.deviceSize.isMobile())) {
        this.sidenav?.open();
      }
    });
  }

  ngOnInit(): void {
    this.school = this.accountService.currentSelectedSchool;
    
    this.accountService.changeSelectedSchool$.pipe(takeUntil(this.unsubscribe$)).subscribe((school: School) => {
      this.school = school;
    });
    
    this.route.queryParams.pipe(takeUntil(this.unsubscribe$)).subscribe(params => {
      if (params['google_calendar']) {
        // If school parameter is provided, switch to that school
        if (params['school']) {
          const schoolId = parseInt(params['school'], 10);
          this.accountService.getSchoolsByUserId().pipe(takeUntil(this.unsubscribe$)).subscribe((schools: School[]) => {
            const school = schools.find(s => s.id === schoolId);
            if (school) {
              this.accountService.setCurrentSchool(school);
            }
          });
        }
        // Open school-setting view
        this.openDetail('schoolSetting');
      }
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  openDetail(type: string){
    if (this.deviceSize.isMobile()) {
      this.sidenav?.close();
    }
    this.type = type;
  }

  backButton() {
    this.sidenav?.open();
  }

}
