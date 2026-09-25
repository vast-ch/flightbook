import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MorePageRoutingModule } from './more-routing.module';
import { MorePage } from './more.page';

@NgModule({
    imports: [
        CommonModule,
        MorePageRoutingModule,
        TranslateModule.forChild(),
        MorePage
    ],
    providers: []
})
export class MorePageModule { }
