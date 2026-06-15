import { DatePipe } from '@angular/common';
import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TCreatedPdf } from 'pdfmake/build/pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Appointment } from 'src/app/shared/domain/appointment';
import { User } from 'src/app/shared/domain/user';
import * as pdfMake from "pdfmake/build/pdfmake.min";
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import moment from 'moment';

@Injectable({
  providedIn: 'root'
})
export class InstructorExportPDFService {

  datePipe: DatePipe;

  constructor(private translate: TranslateService) {
    (<any>pdfMake).addVirtualFileSystem(pdfFonts);
    this.datePipe = new DatePipe('en-US');
  }

  async generateAppointmentExportPdf(user: User, appointments?: Appointment[], startDate?: Date, endDate?: Date): Promise<TCreatedPdf> {
    // Group appointments by school
    const appointmentsBySchool = this.groupBySchool(appointments || []);
    
    // Generate content for each school
    const content: any[] = [];
    const schoolIds = Array.from(appointmentsBySchool.keys());
    
    // First, determine which schools have subscriptions
    const schoolsWithSubscriptions: number[] = [];
    appointmentsBySchool.forEach((schoolAppointments, schoolId) => {
      const appointmentsByType = this.groupByType(schoolAppointments);
      let hasAnySubscriptions = false;
      appointmentsByType.forEach((typeAppointments) => {
        const hasSubscriptions = typeAppointments.some(appointment => 
          appointment.subscriptions && appointment.subscriptions.length > 0
        );
        if (hasSubscriptions) {
          hasAnySubscriptions = true;
        }
      });
      if (hasAnySubscriptions) {
        schoolsWithSubscriptions.push(schoolId);
      }
    });
    
    appointmentsBySchool.forEach((schoolAppointments, schoolId, map) => {
      const school = schoolAppointments[0]?.school;
      
      // Group by appointment type within each school
      const appointmentsByType = this.groupByType(schoolAppointments);
      
      // Check if school has any types with subscriptions
      let hasAnySubscriptions = false;
      appointmentsByType.forEach((typeAppointments) => {
        const hasSubscriptions = typeAppointments.some(appointment => 
          appointment.subscriptions && appointment.subscriptions.length > 0
        );
        if (hasSubscriptions) {
          hasAnySubscriptions = true;
        }
      });
      
      // Skip this school if there are no subscriptions at all
      if (!hasAnySubscriptions) {
        return;
      }
      
      const isLastSchoolWithSubscriptions = schoolsWithSubscriptions.indexOf(schoolId) === schoolsWithSubscriptions.length - 1;
      
      // Add school title with date range (only once per school)
      content.push({
        text: [
          { text: `${school?.name || 'Unknown School'}: `, bold: true, fontSize: 18, color: '#4A90E2' },
          { text: this.formatDateRange(startDate, endDate), bold: true, fontSize: 13 }
        ],
        margin: content.length > 0 ? [0, 20, 0, 0] : [0, 0, 0, 0]
      });
      
      appointmentsByType.forEach((typeAppointments, typeId) => {
        const appointmentType = typeAppointments[0]?.type;
        
        // Check if there are any subscriptions in this type
        const hasSubscriptions = typeAppointments.some(appointment => 
          appointment.subscriptions && appointment.subscriptions.length > 0
        );
        
        // Skip this type if there are no subscriptions
        if (!hasSubscriptions) {
          return;
        }
        
        // Add appointment type title
        content.push({
          text: appointmentType?.name || this.translate.instant('appointmentExport.unknownType'),
          fontSize: 15,
          color: '#4A90E2',
          margin: [0, 10, 0, 10]
        });
        
        // Generate table for this type
        content.push(this.generateTable(typeAppointments));
      });
      
      // Add page break after school section if there's another school with subscriptions
      if (!isLastSchoolWithSubscriptions) {
        content.push({
          text: '',
          pageBreak: 'after'
        });
      }
    });

    let docDefinition: TDocumentDefinitions = {
      pageOrientation: 'landscape',
      header: {
        columns: [{
          fontSize: 8,
          margin: [20, 18, 0, 0],
          text: [
            { text: `${this.translate.instant('appointment.instructor')}: `, bold: true },
            `${user.firstname} ${user.lastname}`
          ]
        },
        {
          fontSize: 8,
          margin: [0, 18, 20, 0],
          text: "https://flightbook.ch",
          alignment: 'right'
        }]
      },

      content: content,
      styles: {
        tableHeader: {
          bold: true,
          fontSize: 9,
          fillColor: '#FFFFFF',
          margin: [0, 0, 0, 0]
        },
        cellDay: {
          alignment: 'center'
        },
        cellDate: {
          alignment: 'left'
        }
      },

      defaultStyle: {
        fontSize: 9
      }
    };

    return pdfMake.createPdf(docDefinition);
  }

  private groupBySchool(appointments: Appointment[]): Map<number, Appointment[]> {
    const grouped = new Map<number, Appointment[]>();
    appointments.forEach(appointment => {
      const schoolId = appointment.school?.id || 0;
      if (!grouped.has(schoolId)) {
        grouped.set(schoolId, []);
      }
      grouped.get(schoolId)!.push(appointment);
    });
    return grouped;
  }

  private groupByType(appointments: Appointment[]): Map<number, Appointment[]> {
    const grouped = new Map<number, Appointment[]>();
    appointments.forEach(appointment => {
      const typeId = appointment.type?.id || 0;
      if (!grouped.has(typeId)) {
        grouped.set(typeId, []);
      }
      grouped.get(typeId)!.push(appointment);
    });
    return grouped;
  }

  private formatDateRange(startDate?: Date, endDate?: Date): string {
    if (!startDate || !endDate) {
      return '';
    }
    return `${moment(startDate).format('DD.MM.YYYY')} - ${moment(endDate).format('DD.MM.YYYY')}`;
  }

  private generateTable(appointments: Appointment[]): any {
    // Sort appointments by date
    const sortedAppointments = appointments.sort((a, b) => {
      const dateA = new Date(a.scheduling || 0).getTime();
      const dateB = new Date(b.scheduling || 0).getTime();
      return dateA - dateB;
    });

    // Group appointments by day
    const appointmentsByDay = new Map<string, Appointment[]>();
    sortedAppointments.forEach(appointment => {
      const dayKey = moment(appointment.scheduling).format('DD.MM.YYYY');
      if (!appointmentsByDay.has(dayKey)) {
        appointmentsByDay.set(dayKey, []);
      }
      appointmentsByDay.get(dayKey)!.push(appointment);
    });

    // Build table rows
    const tableBody: any[] = [
      // Header row
      [
        { text: this.translate.instant('appointmentExport.day'), style: 'tableHeader' },
        { text: this.translate.instant('appointmentExport.date'), style: 'tableHeader' },
        { text: this.translate.instant('appointment.state'), style: 'tableHeader' },
        { text: this.translate.instant('appointment.student'), style: 'tableHeader' },
        { text: this.translate.instant('student.flight.start'), style: 'tableHeader' },
        { text: this.translate.instant('student.flight.landing'), style: 'tableHeader' },
        { text: this.translate.instant('appointment.takeOffCoordinator'), style: 'tableHeader' }
      ]
    ];

    let dayCounter = 1;
    appointmentsByDay.forEach((dayAppointments, dayKey) => {
      // Count total rows for this day (all subscriptions + guest subscriptions + their flights)
      let totalRowsForDay = 0;
      dayAppointments.forEach(appointment => {
        appointment.subscriptions.forEach(subscription => {
          const flightCount = subscription.user?.flights?.length || 0;
          totalRowsForDay += Math.max(flightCount, 1); // At least 1 row per subscription
        });
        // Add guest subscriptions (1 row each)
        totalRowsForDay += appointment.guestSubscriptions?.length || 0;
      });

      let isFirstRowOfDay = true;
      const firstAppointmentState = dayAppointments[0]?.state;
      
      dayAppointments.forEach(appointment => {
        appointment.subscriptions.forEach(subscription => {
          const user = subscription.user;
          const flights = user?.flights || [];
          const takeOffCoordinator = appointment.takeOffCoordinator;
          const takeOffCoordinatorText = appointment.takeOffCoordinatorText;
          
          if (flights.length === 0) {
            // No flights, add one row
            const row: any[] = [];
            
            if (isFirstRowOfDay) {
              row.push({ text: dayCounter.toString(), rowSpan: totalRowsForDay, style: 'cellDay' });
              row.push({ text: dayKey, rowSpan: totalRowsForDay, style: 'cellDate' });
              row.push({ text: this.translate.instant('appointment.stateValue.' + firstAppointmentState), rowSpan: totalRowsForDay });
              isFirstRowOfDay = false;
            } else {
              row.push('', '', '');
            }
            
            row.push(
              { text: `${user?.firstname || ''} ${user?.lastname || ''}`.trim(), color: '#4A90E2' },
              this.translate.instant('appointmentExport.noFlights'),
              '',
              ''
            );
            
            tableBody.push(row);
          } else {
            // Add rows for each flight
            const flightCount = flights.length;
            flights.forEach((flight, flightIndex) => {
              const row: any[] = [];
              
              if (isFirstRowOfDay) {
                row.push({ text: dayCounter.toString(), rowSpan: totalRowsForDay, style: 'cellDay' });
                row.push({ text: dayKey, rowSpan: totalRowsForDay, style: 'cellDate' });
                row.push({ text: this.translate.instant('appointment.stateValue.' + firstAppointmentState), rowSpan: totalRowsForDay });
                isFirstRowOfDay = false;
              } else {
                row.push('', '', '');
              }
              
              if (flightIndex === 0) {
                row.push({ text: `${user?.firstname || ''} ${user?.lastname || ''}`.trim(), color: '#4A90E2', rowSpan: flightCount });
              } else {
                row.push('');
              }
              
              row.push(
                flight.start?.name || '',
                flight.landing?.name || '',
                `${takeOffCoordinator ? takeOffCoordinator.firstname + " " + takeOffCoordinator.lastname : takeOffCoordinatorText || ''}`.trim()
              );
              
              tableBody.push(row);
            });
          }
        });
        
        // Add guest subscriptions
        appointment.guestSubscriptions?.forEach(guestSubscription => {
          const row: any[] = [];
          
          if (isFirstRowOfDay) {
            row.push({ text: dayCounter.toString(), rowSpan: totalRowsForDay, style: 'cellDay' });
            row.push({ text: dayKey, rowSpan: totalRowsForDay, style: 'cellDate' });
            row.push({ text: this.translate.instant('appointment.stateValue.' + firstAppointmentState), rowSpan: totalRowsForDay });
            isFirstRowOfDay = false;
          } else {
            row.push('', '', '');
          }
          
          row.push(
            { text: `${guestSubscription.firstname || ''} ${guestSubscription.lastname || ''} (${this.translate.instant('appointment.guestRegistrations')})`.trim(), color: '#4A90E2' },
            '',
            '',
            ''
          );
          
          tableBody.push(row);
        });
      });
      
      dayCounter++;
    });

    return {
      table: {
        headerRows: 1,
        widths: [20, 50, 60, 100, '*', '*', 100],
        body: tableBody
      },
      layout: {
        hLineWidth: function (i: number) {
          return (i === 0) ? 0 : 0.5;
        },
        vLineWidth: function () {
          return 0;
        },
        hLineColor: function (i: number) {
          return (i === 0 || i === 1) ? '#000000' : '#CCCCCC';
        },
        paddingLeft: function () { return 8; },
        paddingRight: function () { return 8; },
        paddingTop: function () { return 6; },
        paddingBottom: function () { return 6; }
      }
    };
  }
}
