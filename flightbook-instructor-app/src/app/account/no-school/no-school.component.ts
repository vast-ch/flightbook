import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { AccountService } from 'src/app/core/services/account.service';
import { SharedModule } from 'src/app/shared/shared.module';

@Component({
  selector: 'app-no-school',
  imports: [SharedModule, TranslateModule],
  templateUrl: './no-school.component.html',
  styleUrl: './no-school.component.scss'
})
export class NoSchoolComponent implements OnInit, OnDestroy {

  unsubscribe$ = new Subject<void>();

  constructor(
    private accountService: AccountService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.accountService.logout().pipe(takeUntil(this.unsubscribe$)).subscribe(resp => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  navigateToRegister(): void {
    this.router.navigate(['/school/register']);
  }

  navigateToFlightbook(): void {
    window.location.href = 'https://m.flightbook.ch';
  }


}
