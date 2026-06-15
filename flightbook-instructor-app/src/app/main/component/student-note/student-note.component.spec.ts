import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentNoteComponent } from './student-note.component';

describe('StudentNoteComponent', () => {
  let component: StudentNoteComponent;
  let fixture: ComponentFixture<StudentNoteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StudentNoteComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentNoteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
