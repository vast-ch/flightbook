import { DatePipe } from '@angular/common';
import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TCreatedPdf } from 'pdfmake/build/pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Appointment } from 'src/app/shared/domain/appointment';
import { GuestSubscription } from 'src/app/shared/domain/guest-subscription';
import { School } from 'src/app/shared/domain/school';
import { Student } from 'src/app/shared/domain/student';
import { User } from 'src/app/shared/domain/user';
import * as pdfMake from "pdfmake/build/pdfmake.min";
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

@Injectable({
  providedIn: 'root'
})
export class StudentListPDFService {

  datePipe: DatePipe;
  widthFlight = "100";

  constructor(private translate: TranslateService) {
    (<any>pdfMake).addVirtualFileSystem(pdfFonts);
    this.datePipe = new DatePipe('en-US');
  }

  async generatePdf(students: Student[], school: School, appointment?: Appointment): Promise<TCreatedPdf> {
    appointment?.guestSubscriptions.forEach((guestSubscription: GuestSubscription) => {
      const user = new User();
      user.firstname = guestSubscription.firstname;
      user.lastname = guestSubscription.lastname;
      const student = new Student();
      student.user = user;
      students.push(student);
    })

    students = students.sort(((obj1, obj2) => (obj1.user?.firstname && obj2.user?.firstname && obj1.user?.firstname.toLowerCase() > obj2.user?.firstname.toLowerCase() ? 1 : -1)));

    let studentPdfData: any = [];
    const rowHeight = [10];
    students.forEach((student: Student) => {
      const lastFlight = student.lastFlight ? this.datePipe.transform(student.lastFlight?.date, 'dd.MM.yyyy') : '';
      rowHeight.push(70);

      studentPdfData.push([
        {
          text: [
            `${this.translate.instant('account.name')}:\n`,
            `${student.user?.firstname} ${student.user?.lastname}\n`,
            `\n`,
            `${this.translate.instant('student.flight.glider')}\n`,
            `${student.lastFlight?.glider?.brand || ''} ${student.lastFlight?.glider?.name || ''}`
          ],
          style: 'tableRow'
        },
        {
          text: [
            `${this.translate.instant('student.lastflight')}:\n`,
            `${lastFlight}\n`,
            `\n`,
            `${this.translate.instant('student.amountofflights')}:\n`,
            `${student.statistic?.nbFlights || "-"}`
          ],
          style: 'tableRow'
        }
        ,
        {
          text: [
            `${this.translate.instant('student.phone')}:\n`,
            `\n`,
            `\n`,
            `${this.translate.instant('student.emergencyContact')}:\n`,
            `\n`
          ],
          style: 'tableRow'
        },
        { stack: [
          {text:`${this.translate.instant('student.flight.start')}`, bold: true,  fontSize: 8},
          {
            layout: "noBorders",
            table:{
              body:[
                [
                  {width: 10, image: `${student.controlSheet?.level?.start! >= 1 ? 'checked' : 'unchecked'}`},
                  {width: 10, image: `${student.controlSheet?.level?.start! >= 2 ? 'checked' : 'unchecked'}`},
                  {width: 10, image: `${student.controlSheet?.level?.start! >= 3 ? 'checked' : 'unchecked'}`}
                ]
              ]
            }
          },
          {text:`${this.translate.instant('student.flight.maneuver')}`, bold: true,  fontSize: 8},
          {
            layout: "noBorders",
            table:{
              body:[
                [
                  {width: 10, image: `${student.controlSheet?.level?.maneuver! >= 1 ? 'checked' : 'unchecked'}`},
                  {width: 10, image: `${student.controlSheet?.level?.maneuver! >= 2 ? 'checked' : 'unchecked'}`},
                  {width: 10, image: `${student.controlSheet?.level?.maneuver! >= 3 ? 'checked' : 'unchecked'}`}
                ]
              ]
            }
          },
          {text:`${this.translate.instant('student.flight.landing')}`, bold: true,  fontSize: 8},
          {
            layout: "noBorders",
            table:{
              body:[
                [
                  {width: 10, image: `${student.controlSheet?.level?.landing! >= 1 ? 'checked' : 'unchecked'}`},
                  {width: 10, image: `${student.controlSheet?.level?.landing! >= 2 ? 'checked' : 'unchecked'}`},
                  {width: 10, image: `${student.controlSheet?.level?.landing! >= 3 ? 'checked' : 'unchecked'}`}
                ]
              ]
            }
          }
        ]},
        { width: 8, image: 'unchecked'},
        { width: 8, image: 'unchecked'},
        { width: 8, image: 'unchecked'},
        { width: 8, image: 'unchecked'},
        { width: 8, image: 'unchecked'},
      ]);
    })

    let headerText = `${this.translate.instant('studentList.date')}: ................  ${this.translate.instant('studentList.place')}: .........................  ${this.translate.instant('studentList.topic')}: ...................................... ${this.translate.instant('studentList.takeOffCoordinator')}: ................................  ${this.translate.instant('student.phone')}: ...............................`;
    if (appointment) {
      const stringBuilder = [];
      if (appointment.scheduling) {
        appointment.scheduling =  new Date(appointment.scheduling);
      }
      stringBuilder.push(`${this.translate.instant('studentList.date')}: ${this.datePipe.transform(appointment.scheduling, 'dd.MM.yyyy')}     `);
      stringBuilder.push(`${this.translate.instant('studentList.place')}: ${appointment.meetingPoint || " - "}     `);
      stringBuilder.push(`${this.translate.instant('studentList.topic')}: ......................................`);
      if (appointment.takeOffCoordinator) {
        stringBuilder.push(`${this.translate.instant('studentList.takeOffCoordinator')}: ${appointment.takeOffCoordinator?.firstname} ${appointment.takeOffCoordinator?.firstname}    `);
      } else if (appointment.takeOffCoordinatorText) {
        stringBuilder.push(`${this.translate.instant('studentList.takeOffCoordinator')}: ${appointment.takeOffCoordinatorText}    `);
      } else {
        stringBuilder.push(`${this.translate.instant('studentList.takeOffCoordinator')}: ................................`);
      
      }
      stringBuilder.push(`${this.translate.instant('student.phone')}: ...............................`);

      headerText = stringBuilder.join(" ");
    } 

    let docDefinition: TDocumentDefinitions = {
      pageMargins: [20, 30, 20, 10],
      pageOrientation: 'landscape',
      header: {
        columns: [
          {
            fontSize: 10,
            margin: [20, 18, 0, 0],
            width: "*",
            text: headerText
          },
          {
            fontSize: 10,
            margin: [0, 18, 20, 0],
            width: "25%",
            text: `${school.name} nr: ${school.phone}`,
            alignment: 'right'
          }
        ],
        columnGap: 0
      },
      content: [
        {
          style: 'studentTable',
          table: {
            widths: ['*', '8%', '9.5%', '6.5%', '12%', '12%', '12%', '12%', '12%'],
            headerRows: 1,
            heights: rowHeight,
            body: [
              [
                { text: `${this.translate.instant('studentList.information')}`, style: 'tableHeader' },
                { text: "", style: 'tableHeader' },
                { text: "", style: 'tableHeader' },
                { text: `${this.translate.instant('studentList.level')}`, style: 'tableHeader' },
                { text: `1. ${this.translate.instant('studentList.flight')}`, style: 'tableHeader' },
                { text: `2. ${this.translate.instant('studentList.flight')}`, style: 'tableHeader' },
                { text: `3. ${this.translate.instant('studentList.flight')}`, style: 'tableHeader' },
                { text: `4. ${this.translate.instant('studentList.flight')}`, style: 'tableHeader' },
                { text: `5. ${this.translate.instant('studentList.flight')}`, style: 'tableHeader' }
              ],
              ...studentPdfData
            ]
          }
        }
      ],
      images: {
        checked: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAQAAACROWYpAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAF+2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDAgNzkuMTYwNDUxLCAyMDE3LzA1LzA2LTAxOjA4OjIxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOCAoTWFjaW50b3NoKSIgeG1wOkNyZWF0ZURhdGU9IjIwMTktMTItMzBUMDE6Mzc6MjArMDE6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDE5LTEyLTMwVDAxOjM4OjI4KzAxOjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDE5LTEyLTMwVDAxOjM4OjI4KzAxOjAwIiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMSIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9IkRvdCBHYWluIDIwJSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDowNzVjYjZmMy1jNGIxLTRiZjctYWMyOS03YzUxMWY5MWJjYzQiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDo5ZTM1YTc3ZC0zNDM0LTI5NGQtYmEwOC1iY2I5MjYyMjBiOGIiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDowYzc2MDY3Ny0xNDcwLTRlZDUtOGU4ZS1kNTdjODJlZDk1Y2UiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjBjNzYwNjc3LTE0NzAtNGVkNS04ZThlLWQ1N2M4MmVkOTVjZSIgc3RFdnQ6d2hlbj0iMjAxOS0xMi0zMFQwMTozNzoyMCswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTggKE1hY2ludG9zaCkiLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjA3NWNiNmYzLWM0YjEtNGJmNy1hYzI5LTdjNTExZjkxYmNjNCIgc3RFdnQ6d2hlbj0iMjAxOS0xMi0zMFQwMTozODoyOCswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTggKE1hY2ludG9zaCkiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+jHsR7AAAAUNJREFUOMvN1T9Lw0AYx/EviLVFxFH8M3USgyAFoUsQ0UV8F6Ui4qCTbuJg34HgptBdUATrUoxiqYMgiOBoIcW9BVED+jgkntGm9i6CmN+Sg/vAcc89dwBd5Clzj6uZGg7LJAC62UFipEgKcmroaeZj/gpcIAhl5rE1M0cJQbiCOsIrs5h8WZ4R6j72yBrhcRo+dhE8bCOcoYng/hFOMxAXb/DAHTNxcCGo7JE5LqhjsW2KP6nDcGecCv1vRdC2eJQDLllooach2hbvIghvLJJgM0QHdeq8F0x/5ETRM4b0DonF7be+Pf+y4A4bZnETok4E/XG3xxR3WhasUWeLCg2OGYnXGP1MkPwnLRmJf3UN+RfgtBGe5MnHVQShxBQZzdgcIgjXsKSu/KZmXgKxBkmKsZ6bffoAelilQs3goauyTi+8A8mhgeQlxdNWAAAAAElFTkSuQmCC',
        unchecked: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAQAAACROWYpAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAF+2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDAgNzkuMTYwNDUxLCAyMDE3LzA1LzA2LTAxOjA4OjIxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOCAoTWFjaW50b3NoKSIgeG1wOkNyZWF0ZURhdGU9IjIwMTktMTItMzBUMDE6Mzc6MjArMDE6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDE5LTEyLTMwVDAxOjM4OjU3KzAxOjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDE5LTEyLTMwVDAxOjM4OjU3KzAxOjAwIiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMSIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9IkRvdCBHYWluIDIwJSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpjMGUyMmJhZC1lY2VkLTQzZWUtYjIzZC1jNDZjOTNiM2UzNWMiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDo5M2FhOTEzYy1hZDVmLWZmNGEtOWE5Ny1kMmUwZjdmYzFlYmUiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDozYmY2ODFlMy1hMTRhLTQyODMtOGIxNi0zNjQ4M2E2YmZlNjYiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjNiZjY4MWUzLWExNGEtNDI4My04YjE2LTM2NDgzYTZiZmU2NiIgc3RFdnQ6d2hlbj0iMjAxOS0xMi0zMFQwMTozNzoyMCswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTggKE1hY2ludG9zaCkiLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOmMwZTIyYmFkLWVjZWQtNDNlZS1iMjNkLWM0NmM5M2IzZTM1YyIgc3RFdnQ6d2hlbj0iMjAxOS0xMi0zMFQwMTozODo1NyswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTggKE1hY2ludG9zaCkiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+6AB6cQAAAPxJREFUOMvF1b1Kw1AYBuAnFf8QL8WlIHQJIriIdyEu4qCTXop7dwenTgUHpYvgJVhob8AuakE+h9hapJqcFDXvFDgPIXlzvgNLjnQ9GlRM340TK7DsUtRI2zqH09txxUzWn3IrhK4DecXs6wjhnqHwZk/K1fIiDAs81krCW54KPBDG8iTcNBIGf4ND1MWTdmrgqIOL5TM0S8SRhmMu1dAo+2DZ57t9eWajtKrvN1GVnrMK9HewhbBy+nPPJbTsJwmymOn8P7fkfLzQGCoG4G4S3vZc4J4QOnY0KyZ3LYQHjqcjf1Qxrx/inDXtWsfNlU1YdeZOP+Gg67mwwTvIDqR1iAowgQAAAABJRU5ErkJggg==',
    },
      styles: {
        h1: {
          alignment: "center",
          fontSize: 14,
          bold: true
        },
        studentTable: {
          margin: [0, 10, 0, 0],
          fontSize: 10
        }
      }
    };

    return pdfMake.createPdf(docDefinition);
  }

  async generatePdf_V2(students: Student[], school: School, appointment?: Appointment): Promise<TCreatedPdf> {
    appointment?.guestSubscriptions.forEach((guestSubscription: GuestSubscription) => {
      const user = new User();
      user.firstname = guestSubscription.firstname;
      user.lastname = guestSubscription.lastname;
      const student = new Student();
      student.user = user;
      students.push(student);
    })

    students = students.sort(((obj1, obj2) => (obj1.user?.firstname && obj2.user?.firstname && obj1.user?.firstname.toLowerCase() > obj2.user?.firstname.toLowerCase() ? 1 : -1)));

    let studentPdfData: any = [];
    const rowHeight = [10];
    students.forEach((student: Student) => {
      rowHeight.push(60);
      const lastFlightDate = student.lastFlight ? this.datePipe.transform(student.lastFlight?.date, 'dd.MM.yyyy') : '';

      studentPdfData.push([
        {
          stack: [
            { text: `${student.user?.firstname} ${student.user?.lastname}`, bold: true,  fontSize: 10},
            { text: `${student.lastFlight?.glider?.brand || ''} ${student.lastFlight?.glider?.name || ''}${student.lastFlight?.glider?.color ? ' (' + student.lastFlight?.glider?.color + ')' : ''}`},
            { text: student.statistic ? student.statistic?.nbFlights + " " + this.translate.instant('export.flights') + " - " + lastFlightDate : ""},
            { text: `${student.user?.phone || ''}`},
            { text: `${student.emergencyContacts && student.emergencyContacts.length > 0 ? this.translate.instant('student.emergencyContact') : ''}`, bold: true,  fontSize: 10, margin: [0, 3, 0, 0]},
            { text: `${student.emergencyContacts && student.emergencyContacts.length > 0 ? (student.emergencyContacts[0].firstname || '-') + ' ' + (student.emergencyContacts[0].lastname || '-') : ''}`},
            { text: `${student.emergencyContacts && student.emergencyContacts.length > 0 ? (student.emergencyContacts[0].phone || '-') : ''}`},
          ]
        },
        { stack: [
          {text:`${this.translate.instant('student.flight.start')}`, bold: true,  fontSize: 8},
          {
            layout: "noBorders",
            table:{
              body:[
                [
                  {width: 10, image: `${student.controlSheet?.level?.start! >= 1 ? 'checked' : 'unchecked'}`},
                  {width: 10, image: `${student.controlSheet?.level?.start! >= 2 ? 'checked' : 'unchecked'}`},
                  {width: 10, image: `${student.controlSheet?.level?.start! >= 3 ? 'checked' : 'unchecked'}`}
                ]
              ]
            }
          },
          {text:`${this.translate.instant('student.flight.maneuver')}`, bold: true,  fontSize: 8},
          {
            layout: "noBorders",
            table:{
              body:[
                [
                  {width: 10, image: `${student.controlSheet?.level?.maneuver! >= 1 ? 'checked' : 'unchecked'}`},
                  {width: 10, image: `${student.controlSheet?.level?.maneuver! >= 2 ? 'checked' : 'unchecked'}`},
                  {width: 10, image: `${student.controlSheet?.level?.maneuver! >= 3 ? 'checked' : 'unchecked'}`}
                ]
              ]
            }
          },
          {text:`${this.translate.instant('student.flight.landing')}`, bold: true,  fontSize: 8},
          {
            layout: "noBorders",
            table:{
              body:[
                [
                  {width: 10, image: `${student.controlSheet?.level?.landing! >= 1 ? 'checked' : 'unchecked'}`},
                  {width: 10, image: `${student.controlSheet?.level?.landing! >= 2 ? 'checked' : 'unchecked'}`},
                  {width: 10, image: `${student.controlSheet?.level?.landing! >= 3 ? 'checked' : 'unchecked'}`}
                ]
              ]
            }
          }
        ]},
        { width: 10, image: 'unchecked', fillColor: '#d9d9d9'},
        { width: 10, image: 'unchecked'},
        { width: 10, image: 'unchecked', fillColor: '#d9d9d9'},
        { width: 10, image: 'unchecked'},
        { width: 10, image: 'unchecked', fillColor: '#d9d9d9'},
        { stack: [
          {text:`${student.lastNote ? this.datePipe.transform(student.lastNote?.date, 'dd.MM.yyyy'):''}`, bold: true },
          {text:`${student.lastNote ? student.lastNote?.text :''}`, fontSize: 8},
        ]},
      ]);
    })

    let headerText = `${this.translate.instant('studentList.date')}: ................  ${this.translate.instant('studentList.place')}: .........................  ${this.translate.instant('studentList.topic')}: ...................................... ${this.translate.instant('studentList.takeOffCoordinator')}: ................................  ${this.translate.instant('student.phone')}: ...............................`;
    if (appointment) {
      const stringBuilder = [];
      if (appointment.scheduling) {
        appointment.scheduling =  new Date(appointment.scheduling);
      }
      stringBuilder.push(`${this.translate.instant('studentList.date')}: ${this.datePipe.transform(appointment.scheduling, 'dd.MM.yyyy')} `);
      stringBuilder.push(`${this.translate.instant('studentList.place')}: ${appointment.meetingPoint || " - "} `);
      stringBuilder.push(`${this.translate.instant('studentList.topic')}: ......................................`);
      if (appointment.takeOffCoordinator) {
        stringBuilder.push(`${this.translate.instant('studentList.takeOffCoordinator')}: ${appointment.takeOffCoordinator?.firstname} ${appointment.takeOffCoordinator?.firstname}  `);
      } else if (appointment.takeOffCoordinatorText && appointment.takeOffCoordinatorText.length > 0) {
        stringBuilder.push(`${this.translate.instant('studentList.takeOffCoordinator')}: ${appointment.takeOffCoordinatorText} `);
      } else {
        stringBuilder.push(`${this.translate.instant('studentList.takeOffCoordinator')}: ................................`);
      
      }
      stringBuilder.push(`${this.translate.instant('student.phone')}: ...............................`);

      headerText = stringBuilder.join(" ");
    } 

    let docDefinition: TDocumentDefinitions = {
      pageMargins: [20, 30, 20, 10],
      pageOrientation: 'portrait',
      header: {
        columns: [
          {
            fontSize: 8,
            margin: [20, 18, 0, 0],
            width: "*",
            text: headerText
          },
          {
            fontSize: 8,
            margin: [0, 18, 20, 0],
            width: "25%",
            text: `${school.name} nr: ${school.phone}`,
            alignment: 'right'
          }
        ],
        columnGap: 0
      },
      content: [
        {
          style: 'studentTable',
          table: {
            widths: ['*','10%', '7%', '7%', '7%', '7%', '7%', '37%'],
            headerRows: 1,
            heights: rowHeight,
            body: [
              [
                { text: `${this.translate.instant('studentList.information')}`, style: 'tableHeader' },
                { text: `${this.translate.instant('studentList.level')}`, style: 'tableHeader' },
                { text: `1. ${this.translate.instant('studentList.flight')}`, style: 'tableHeader', fillColor: '#d9d9d9' },
                { text: `2. ${this.translate.instant('studentList.flight')}`, style: 'tableHeader' },
                { text: `3. ${this.translate.instant('studentList.flight')}`, style: 'tableHeader', fillColor: '#d9d9d9' },
                { text: `4. ${this.translate.instant('studentList.flight')}`, style: 'tableHeader' },
                { text: `5. ${this.translate.instant('studentList.flight')}`, style: 'tableHeader', fillColor: '#d9d9d9' },
                { text: `${this.translate.instant('studentList.comments')}`, style: 'tableHeader' }
              ],
              ...studentPdfData
            ]
          }
        }
      ],
      images: {
        checked: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAQAAACROWYpAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAF+2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDAgNzkuMTYwNDUxLCAyMDE3LzA1LzA2LTAxOjA4OjIxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOCAoTWFjaW50b3NoKSIgeG1wOkNyZWF0ZURhdGU9IjIwMTktMTItMzBUMDE6Mzc6MjArMDE6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDE5LTEyLTMwVDAxOjM4OjI4KzAxOjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDE5LTEyLTMwVDAxOjM4OjI4KzAxOjAwIiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMSIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9IkRvdCBHYWluIDIwJSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDowNzVjYjZmMy1jNGIxLTRiZjctYWMyOS03YzUxMWY5MWJjYzQiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDo5ZTM1YTc3ZC0zNDM0LTI5NGQtYmEwOC1iY2I5MjYyMjBiOGIiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDowYzc2MDY3Ny0xNDcwLTRlZDUtOGU4ZS1kNTdjODJlZDk1Y2UiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjBjNzYwNjc3LTE0NzAtNGVkNS04ZThlLWQ1N2M4MmVkOTVjZSIgc3RFdnQ6d2hlbj0iMjAxOS0xMi0zMFQwMTozNzoyMCswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTggKE1hY2ludG9zaCkiLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjA3NWNiNmYzLWM0YjEtNGJmNy1hYzI5LTdjNTExZjkxYmNjNCIgc3RFdnQ6d2hlbj0iMjAxOS0xMi0zMFQwMTozODoyOCswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTggKE1hY2ludG9zaCkiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+jHsR7AAAAUNJREFUOMvN1T9Lw0AYx/EviLVFxFH8M3USgyAFoUsQ0UV8F6Ui4qCTbuJg34HgptBdUATrUoxiqYMgiOBoIcW9BVED+jgkntGm9i6CmN+Sg/vAcc89dwBd5Clzj6uZGg7LJAC62UFipEgKcmroaeZj/gpcIAhl5rE1M0cJQbiCOsIrs5h8WZ4R6j72yBrhcRo+dhE8bCOcoYng/hFOMxAXb/DAHTNxcCGo7JE5LqhjsW2KP6nDcGecCv1vRdC2eJQDLllooach2hbvIghvLJJgM0QHdeq8F0x/5ETRM4b0DonF7be+Pf+y4A4bZnETok4E/XG3xxR3WhasUWeLCg2OGYnXGP1MkPwnLRmJf3UN+RfgtBGe5MnHVQShxBQZzdgcIgjXsKSu/KZmXgKxBkmKsZ6bffoAelilQs3goauyTi+8A8mhgeQlxdNWAAAAAElFTkSuQmCC',
        unchecked: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAQAAACROWYpAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAF+2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDAgNzkuMTYwNDUxLCAyMDE3LzA1LzA2LTAxOjA4OjIxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOCAoTWFjaW50b3NoKSIgeG1wOkNyZWF0ZURhdGU9IjIwMTktMTItMzBUMDE6Mzc6MjArMDE6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDE5LTEyLTMwVDAxOjM4OjU3KzAxOjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDE5LTEyLTMwVDAxOjM4OjU3KzAxOjAwIiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMSIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9IkRvdCBHYWluIDIwJSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpjMGUyMmJhZC1lY2VkLTQzZWUtYjIzZC1jNDZjOTNiM2UzNWMiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDo5M2FhOTEzYy1hZDVmLWZmNGEtOWE5Ny1kMmUwZjdmYzFlYmUiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDozYmY2ODFlMy1hMTRhLTQyODMtOGIxNi0zNjQ4M2E2YmZlNjYiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjNiZjY4MWUzLWExNGEtNDI4My04YjE2LTM2NDgzYTZiZmU2NiIgc3RFdnQ6d2hlbj0iMjAxOS0xMi0zMFQwMTozNzoyMCswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTggKE1hY2ludG9zaCkiLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOmMwZTIyYmFkLWVjZWQtNDNlZS1iMjNkLWM0NmM5M2IzZTM1YyIgc3RFdnQ6d2hlbj0iMjAxOS0xMi0zMFQwMTozODo1NyswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTggKE1hY2ludG9zaCkiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+6AB6cQAAAPxJREFUOMvF1b1Kw1AYBuAnFf8QL8WlIHQJIriIdyEu4qCTXop7dwenTgUHpYvgJVhob8AuakE+h9hapJqcFDXvFDgPIXlzvgNLjnQ9GlRM340TK7DsUtRI2zqH09txxUzWn3IrhK4DecXs6wjhnqHwZk/K1fIiDAs81krCW54KPBDG8iTcNBIGf4ND1MWTdmrgqIOL5TM0S8SRhmMu1dAo+2DZ57t9eWajtKrvN1GVnrMK9HewhbBy+nPPJbTsJwmymOn8P7fkfLzQGCoG4G4S3vZc4J4QOnY0KyZ3LYQHjqcjf1Qxrx/inDXtWsfNlU1YdeZOP+Gg67mwwTvIDqR1iAowgQAAAABJRU5ErkJggg==',
    },
      styles: {
        h1: {
          alignment: "center",
          fontSize: 14,
          bold: true
        },
        studentTable: {
          margin: [0, 10, 0, 0],
          fontSize: 9
        }
      }
    };

    return pdfMake.createPdf(docDefinition);
  }
}
