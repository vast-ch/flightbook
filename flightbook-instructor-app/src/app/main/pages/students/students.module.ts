import { NgModule } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { StudentsComponent } from './students.component';
import { StudentsRoutingModule } from './students-routing.module';
import { StudentDetailComponent } from '../../component/student-detail/student-detail.component';
import { SharedModule } from 'src/app/shared/shared.module';
import { EmailDialogComponent } from '../../component/email-dialog/email-dialog.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ControlSheetComponent } from '../../component/control-sheet/control-sheet.component';
import { TranslateModule } from '@ngx-translate/core';
import { StudentNoteComponent } from '../../component/student-note/student-note.component';
import { StartRatingComponent } from '../../component/start-rating/start-rating.component';
import { LevelComponent } from '../../component/level/level.component';



@NgModule({
  declarations: [
    StudentsComponent,
    StudentDetailComponent,
    ControlSheetComponent,
    LevelComponent,
    StudentNoteComponent,
    StartRatingComponent
  ],
  imports: [
    CommonModule,
    KeyValuePipe,
    ReactiveFormsModule,
    TranslateModule.forChild(),
    SharedModule,
    StudentsRoutingModule,
    FormsModule,
    EmailDialogComponent
  ]
})
export class StudentsModule { }
