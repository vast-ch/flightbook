import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { Injectable } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {

    constructor(
        private router: Router,
        private snackBar: MatSnackBar,
        private translate: TranslateService,
    ) { }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(request).pipe(catchError(err => {
            if (err.status === 401 && !this.router.url.includes("/enrollments/") && !this.router.url.includes("/school/register")) {
                this.router.navigate(['login']);
            }

            if (err.status >= 500 || err.status === 0) {
                this.snackBar.open(this.translate.instant('message.error'), this.translate.instant('buttons.done'), {
                    horizontalPosition: 'center',
                    verticalPosition: 'top',
                });
            }

            if (err.status === 403) {
                this.snackBar.open(this.translate.instant('message.403'), this.translate.instant('buttons.done'), {
                    horizontalPosition: 'center',
                    verticalPosition: 'top',
                });
            }
            return throwError(() => err);
        }));
    }
}
