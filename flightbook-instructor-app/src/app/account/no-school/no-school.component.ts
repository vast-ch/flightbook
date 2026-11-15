import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { AccountService } from 'src/app/core/services/account.service';
import { SharedModule } from 'src/app/shared/shared.module';

/** Shown when the logged-in user belongs to no flight school (No School.dc.html). Logs the user out on entry. */
@Component({
  selector: 'app-no-school',
  imports: [SharedModule, TranslateModule, RouterLink],
  templateUrl: './no-school.component.html',
  styleUrl: './no-school.component.scss'
})
export class NoSchoolComponent implements OnInit, OnDestroy {

  unsubscribe$ = new Subject<void>();

  constructor(private accountService: AccountService) { }

  ngOnInit(): void {
    this.accountService.logout().pipe(takeUntil(this.unsubscribe$)).subscribe(() => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
