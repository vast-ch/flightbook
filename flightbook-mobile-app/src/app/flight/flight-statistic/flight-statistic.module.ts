import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlightStatisticPageRoutingModule } from './flight-statistic-routing.module';

import { FlightStatisticPage } from './flight-statistic.page';
import { TranslateModule } from '@ngx-translate/core';

// ChartsModule is deliberately not imported: the redesigned page uses its own
// compact charts, so pulling it in would keep chartjs-plugin-zoom,
// chartjs-plugin-datalabels and hammerjs in this lazy chunk for nothing.
@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        FlightStatisticPageRoutingModule,
        TranslateModule.forChild(),
        FlightStatisticPage
    ]
})
export class FlightStatisticPageModule { }
