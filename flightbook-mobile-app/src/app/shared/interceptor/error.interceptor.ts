import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpContextToken } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { Injectable, Injector, inject } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import HttpStatusCode from '../util/HttpStatusCode';
import { SessionService } from '../services/session.service';

export const IGNORE_ERROR = new HttpContextToken(() => false);

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {

    /*
     * Resolved on demand rather than injected: SessionService reaches HttpClient
     * through AccountService, and an interceptor that took it in its constructor
     * would close a DI cycle.
     */
    private injector = inject(Injector);

    constructor(
        private router: Router,
        private alertController: AlertController,
        private translate: TranslateService
    ) { }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(request).pipe(catchError(err => {
            if (err.status === HttpStatusCode.UNAUTHORIZED) {
                // The one place that sees every expired session. Without this the
                // tokens, the five feature stores, the shared filters and the
                // entitlements all survived, and `bootstrapped` stayed true - so
                // the next account to sign in skipped the identity and
                // payment-status refetch and was shown the previous pilot's
                // dashboard and logbook. There is no refresh-on-401 retry to
                // break: auth.interceptor refreshes ahead of the request.
                //
                // Guarded on a token being present so this is idempotent: a
                // rejected sign-in is also a 401, and clearing resets the shared
                // filters - which the filter sheet's debounced count request
                // watches, so an unguarded clear could answer its own 401.
                if (localStorage.getItem('access_token') || localStorage.getItem('refresh_token')) {
                    this.injector.get(SessionService).clearLocalSession();
                }
                this.router.navigate(['login']);
            }

            if (request.context.get(IGNORE_ERROR) === true) {
                return throwError(err);
            }

            if (err.status >= 500 || err.status === 0) {
                this.alertController.create({
                    header: this.translate.instant('message.errortitle'),
                    message: this.translate.instant('message.error'),
                    buttons: [this.translate.instant('buttons.done')]
                }).then((alert: any) => {
                    alert.present();
                });
            }
            return throwError(err);
        }));
    }
}
