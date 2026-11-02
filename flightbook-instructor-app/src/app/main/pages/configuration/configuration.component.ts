import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AccountService } from 'src/app/core/services/account.service';
import { School } from 'src/app/shared/domain/school';

@Component({
    selector: 'app-configuration',
    templateUrl: './configuration.component.html',
    styleUrls: ['./configuration.component.scss'],
    standalone: false
})
export class ConfigurationComponent implements OnInit, OnDestroy {

  school?: School;
  unsubscribe$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private accountService: AccountService
  ) { }

  ngOnInit(): void {
    this.school = this.accountService.currentSelectedSchool;
    
    this.accountService.changeSelectedSchool$.pipe(takeUntil(this.unsubscribe$)).subscribe((school: School) => {
      this.school = school;
    });
    
    this.route.queryParams.pipe(takeUntil(this.unsubscribe$)).subscribe(params => {
      // If school parameter is provided, switch to that school
      if (params['google_calendar'] && params['school']) {
        const schoolId = parseInt(params['school'], 10);
        this.accountService.getSchoolsByUserId().pipe(takeUntil(this.unsubscribe$)).subscribe((schools: School[]) => {
          const school = schools.find(s => s.id === schoolId);
          if (school) {
            this.accountService.setCurrentSchool(school);
          }
        });
      }
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

}
