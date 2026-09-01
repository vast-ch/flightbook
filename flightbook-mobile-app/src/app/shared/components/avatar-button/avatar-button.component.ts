import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AccountService } from 'src/app/account/shared/account.service';

/**
 * The profile shortcut in the leading slot of every main-tab header. A component
 * rather than four copies of the same markup, so none of Home, Flights, Stats or
 * More needs its own initials computed or navigation handler.
 *
 * Styling lives in theme/tokens.scss as .fb-avatar-button.
 */
@Component({
    selector: 'fb-avatar-button',
    standalone: true,
    imports: [TranslateModule],
    templateUrl: './avatar-button.component.html',
    styles: [':host { display: contents; }']
})
export class AvatarButtonComponent {
    private accountService = inject(AccountService);
    private router = inject(Router);

    public initials = computed(() => {
        const user = this.accountService.currentUser$();
        if (!user) {
            return '';
        }
        return `${user.firstname?.charAt(0) ?? ''}${user.lastname?.charAt(0) ?? ''}`.toUpperCase();
    });

    openAccount() {
        this.router.navigate(['settings']);
    }
}
