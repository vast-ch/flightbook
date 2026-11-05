import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { HomePageRoutingModule } from './home-routing.module';
import { HomePage } from './home.page';

@NgModule({
    imports: [
        CommonModule,
        HomePageRoutingModule,
        TranslateModule.forChild(),
        HomePage
    ],
    providers: []
})
export class HomePageModule { }
