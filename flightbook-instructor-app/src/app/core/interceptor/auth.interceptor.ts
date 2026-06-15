import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, from, lastValueFrom } from 'rxjs';
import { Injectable } from '@angular/core';
import { AccountService } from '../services/account.service';
import { environment } from 'src/environments/environment';

@Injectable()
export class HttpAuthInterceptor implements HttpInterceptor {
    // Keep track of the current auth promise to prevent multiple concurrent auth requests
    private authPromise: Promise<boolean> | null = null;
    
    // URLs that should bypass authentication handling
    private authUrls = [
        `${environment.baseUrl}/auth/refresh`,
        `${environment.baseUrl}/auth/login`
    ];

    constructor(private accoutService: AccountService) {}

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        // Skip authentication for auth-related endpoints to prevent circular dependencies
        if (this.isAuthUrl(req.url)) {
            console.log('Bypassing auth intercept for auth URL:', req.url);
            return next.handle(this.setHeaders(req, false));
        }
        
        return from(this.handle(req, next));
    }

    async handle(req: HttpRequest<any>, next: HttpHandler): Promise<HttpEvent<any>> {
        // Reuse the existing auth promise if one is in progress
        if (!this.authPromise) {
            this.authPromise = this.accoutService.isAuth();
            
            // Clear the reference after it completes (success or error)
            this.authPromise.finally(() => {
                this.authPromise = null;
            });
        }
        
        // Wait for the auth to complete
        await this.authPromise;
        
        // Use lastValueFrom instead of toPromise() to get a Promise<HttpEvent<any>>
        return await lastValueFrom(next.handle(this.setHeaders(req, true)));
    }
    
    private isAuthUrl(url: string): boolean {
        return this.authUrls.some(authUrl => url.includes(authUrl));
    }

    private setHeaders(request: HttpRequest<any>, includeAuth: boolean = true): HttpRequest<any> {
        const headers: any = {
            'Content-Type': 'application/json',
            'Accept-Language': localStorage.getItem('language') || navigator.language.split('-')[0]
        };
        
        if (includeAuth) {
            headers['Authorization'] = `Bearer ${localStorage.getItem('access_token')}`;
        }
        
        return request.clone({
            setHeaders: headers
        });
    }
}
