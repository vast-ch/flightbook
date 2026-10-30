import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { MapConfiguration } from '../domain/map-configuration';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConfigurationService {
  private http = inject(HttpClient);

  /**
   * shareReplay(1), not a BehaviorSubject: a plain Observable re-runs its
   * source per subscriber, so two callers racing before the first response
   * lands (e.g. an IGC map and a place map mounting together) would each
   * fire their own GET. shareReplay multicasts the one in-flight request to
   * both, then keeps serving the cached value after it completes - static
   * app config, never invalidated.
   */
  private mapConfiguration$: Observable<MapConfiguration> = this.http
    .get<MapConfiguration>(`${environment.baseUrl}/configuration/map`)
    .pipe(shareReplay(1));

  getMapConfiguration(): Observable<MapConfiguration> {
    return this.mapConfiguration$;
  }
}
