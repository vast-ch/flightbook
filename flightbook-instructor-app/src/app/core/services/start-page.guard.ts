import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AccountService } from './account.service';
import { resolveStartPage } from 'src/app/shared/domain/school-config';

/** Sends the bare root URL to the selected school's configured start page. */
export const startPageGuard: CanActivateFn = async (): Promise<UrlTree> => {
  const router = inject(Router);
  const schools = await firstValueFrom(inject(AccountService).getSchools());
  if (schools.length === 0) {
    return router.createUrlTree(['no-school']);
  }
  // MainComponent selects schools[0] too, so this matches the school shown after load.
  return router.createUrlTree([resolveStartPage(schools[0].configuration)]);
};
