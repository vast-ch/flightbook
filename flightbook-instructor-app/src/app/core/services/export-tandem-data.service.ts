import { Injectable } from '@angular/core';
import { DatePipe } from '@angular/common';
import * as XLSX from 'xlsx';
import { TandemPilot } from 'src/app/shared/domain/tandem-pilot';
import { Flight } from 'src/app/shared/domain/flight';
import { PassengerConfirmation } from 'src/app/shared/domain/passenger-confirmation';
import { CustomFieldDefinition } from 'src/app/shared/domain/school-config';
import { TranslateService } from '@ngx-translate/core';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ExportTandemDataService {

  constructor(
    private datePipe: DatePipe,
    private translate: TranslateService
  ) { }

  exportTandemPilotData(
    pilot: TandemPilot,
    flights: Flight[],
    passengers: PassengerConfirmation[],
    customFields: CustomFieldDefinition[],
    dateRange?: DateRange
  ): void {
    const filteredFlights = this.filterByDateRange(flights, dateRange);
    const filteredPassengers = this.filterPassengersByDateRange(passengers, dateRange);

    const workbook = XLSX.utils.book_new();

    const flightSheet = this.generateFlightSheet(filteredFlights, customFields, pilot);
    XLSX.utils.book_append_sheet(workbook, flightSheet, this.translate.instant('export.flightData'));

    const passengerSheet = this.generatePassengerSheet(filteredPassengers, pilot);
    XLSX.utils.book_append_sheet(workbook, passengerSheet, this.translate.instant('export.passengerConfirmations'));

    const filename = `tandem-pilot-${pilot.user?.firstname}-${pilot.user?.lastname}-${this.datePipe.transform(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  exportAllTandemPilotsData(
    pilots: TandemPilot[],
    allFlights: Map<number, Flight[]>,
    allPassengers: Map<number, PassengerConfirmation[]>,
    customFields: CustomFieldDefinition[],
    dateRange?: DateRange
  ): void {
    const workbook = XLSX.utils.book_new();

    const allFlightsArray: any[] = [];
    const allPassengersArray: any[] = [];

    pilots.forEach(pilot => {
      const pilotFlights = allFlights.get(pilot.id!) || [];
      const pilotPassengers = allPassengers.get(pilot.id!) || [];

      const filteredFlights = this.filterByDateRange(pilotFlights, dateRange);
      const filteredPassengers = this.filterPassengersByDateRange(pilotPassengers, dateRange);

      filteredFlights.forEach(flight => {
        allFlightsArray.push({
          pilotName: `${pilot.user?.firstname} ${pilot.user?.lastname}`,
          flight: flight
        });
      });

      filteredPassengers.forEach(passenger => {
        allPassengersArray.push({
          pilotName: `${pilot.user?.firstname} ${pilot.user?.lastname}`,
          passenger: passenger
        });
      });
    });

    const flightSheet = this.generateAllPilotsFlightSheet(allFlightsArray, customFields);
    XLSX.utils.book_append_sheet(workbook, flightSheet, this.translate.instant('export.flightData'));

    const passengerSheet = this.generateAllPilotsPassengerSheet(allPassengersArray);
    XLSX.utils.book_append_sheet(workbook, passengerSheet, this.translate.instant('export.passengerConfirmations'));

    const filename = `all-tandem-pilots-${this.datePipe.transform(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  generateFlightSheet(flights: Flight[], customFields: CustomFieldDefinition[], pilot?: TandemPilot): XLSX.WorkSheet {
    const data: any[] = [];

    const headers = [];
    
    if (pilot) {
      headers.push(this.translate.instant('tandemPilot.pilotName'));
    }
    
    headers.push(
      this.translate.instant('student.flight.date'),
      this.translate.instant('student.flight.start'),
      this.translate.instant('student.flight.landing'),
      this.translate.instant('student.flight.time'),
      this.translate.instant('student.flight.description'),
      this.translate.instant('student.flight.paymentState.label'),
      this.translate.instant('student.flight.paymentState.amount')
    );

    const activeCustomFields = customFields.filter(f => !f.disabled);
    activeCustomFields.forEach(field => {
      headers.push(field.label);
    });

    data.push(headers);

    flights.forEach(flight => {
      const row = [];
      
      if (pilot) {
        row.push(`${pilot.user?.firstname} ${pilot.user?.lastname}`);
      }
      
      row.push(
        this.datePipe.transform(flight.date, 'dd.MM.yyyy'),
        flight.start?.name || '',
        flight.landing?.name || '',
        flight.time?.split(':').slice(0, 2).join(':') || '',
        flight.description || '',
        this.getPaymentStateLabel(flight.tandemSchoolData?.paymentState),
        flight.tandemSchoolData?.paymentAmount || ''
      );

      activeCustomFields.forEach(field => {
        const value = this.getCustomFieldValue(flight, field.key);
        row.push(this.formatCustomFieldValue(value, field.type));
      });

      data.push(row);
    });

    return XLSX.utils.aoa_to_sheet(data);
  }

  generateAllPilotsFlightSheet(flightsWithPilot: any[], customFields: CustomFieldDefinition[]): XLSX.WorkSheet {
    const data: any[] = [];

    const headers = [
      this.translate.instant('tandemPilot.pilotName'),
      this.translate.instant('student.flight.date'),
      this.translate.instant('student.flight.start'),
      this.translate.instant('student.flight.landing'),
      this.translate.instant('student.flight.time'),
      this.translate.instant('student.flight.description'),
      this.translate.instant('student.flight.paymentState.label'),
      this.translate.instant('student.flight.paymentState.amount')
    ];

    const activeCustomFields = customFields.filter(f => !f.disabled);
    activeCustomFields.forEach(field => {
      headers.push(field.label);
    });

    data.push(headers);

    flightsWithPilot.forEach(item => {
      const flight = item.flight;
      const row = [
        item.pilotName,
        this.datePipe.transform(flight.date, 'dd.MM.yyyy'),
        flight.start?.name || '',
        flight.landing?.name || '',
        flight.time?.split(':').slice(0, 2).join(':') || '',
        flight.description || '',
        this.getPaymentStateLabel(flight.tandemSchoolData?.paymentState),
        flight.tandemSchoolData?.paymentAmount || ''
      ];

      activeCustomFields.forEach(field => {
        const value = this.getCustomFieldValue(flight, field.key);
        row.push(this.formatCustomFieldValue(value, field.type));
      });

      data.push(row);
    });

    return XLSX.utils.aoa_to_sheet(data);
  }

  generatePassengerSheet(passengers: PassengerConfirmation[], pilot?: TandemPilot): XLSX.WorkSheet {
    const data: any[] = [];

    const headers = [];
    
    if (pilot) {
      headers.push(this.translate.instant('tandemPilot.pilotName'));
    }
    
    headers.push(
      this.translate.instant('passengerConfirmation.date'),
      this.translate.instant('passengerConfirmation.name'),
      this.translate.instant('passengerConfirmation.place'),
      this.translate.instant('passengerConfirmation.phone'),
      this.translate.instant('passengerConfirmation.email'),
      this.translate.instant('passengerConfirmation.canUseData')
    );

    data.push(headers);

    passengers.forEach(passenger => {
      const row = [];
      
      if (pilot) {
        row.push(`${pilot.user?.firstname} ${pilot.user?.lastname}`);
      }
      
      row.push(
        this.datePipe.transform(passenger.date, 'dd.MM.yyyy'),
        `${passenger.firstname} ${passenger.lastname}`,
        passenger.place || '',
        passenger.phone || '',
        passenger.email || '',
        passenger.canUseData 
          ? this.translate.instant('passengerConfirmation.yes') 
          : this.translate.instant('passengerConfirmation.no')
      );
      
      data.push(row);
    });

    return XLSX.utils.aoa_to_sheet(data);
  }

  generateAllPilotsPassengerSheet(passengersWithPilot: any[]): XLSX.WorkSheet {
    const data: any[] = [];

    data.push([
      this.translate.instant('tandemPilot.pilotName'),
      this.translate.instant('passengerConfirmation.date'),
      this.translate.instant('passengerConfirmation.name'),
      this.translate.instant('passengerConfirmation.place'),
      this.translate.instant('passengerConfirmation.phone'),
      this.translate.instant('passengerConfirmation.email'),
      this.translate.instant('passengerConfirmation.canUseData')
    ]);

    passengersWithPilot.forEach(item => {
      const passenger = item.passenger;
      data.push([
        item.pilotName,
        this.datePipe.transform(passenger.date, 'dd.MM.yyyy'),
        `${passenger.firstname} ${passenger.lastname}`,
        passenger.place || '',
        passenger.phone || '',
        passenger.email || '',
        passenger.canUseData 
          ? this.translate.instant('passengerConfirmation.yes') 
          : this.translate.instant('passengerConfirmation.no')
      ]);
    });

    return XLSX.utils.aoa_to_sheet(data);
  }

  private getCustomFieldValue(flight: Flight, key: string): any {
    if (!flight.tandemSchoolData?.schoolCustomValues) {
      return null;
    }
    const customValue = flight.tandemSchoolData.schoolCustomValues.find(cv => cv.key === key);
    return customValue ? customValue.value : null;
  }

  private formatCustomFieldValue(value: any, type: string): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    switch (type) {
      case 'date':
        return this.datePipe.transform(value, 'dd.MM.yyyy') || '';
      case 'boolean':
        return value ? this.translate.instant('buttons.yes') : this.translate.instant('buttons.no');
      case 'number':
        return value.toString();
      case 'text':
      case 'dropdown':
      default:
        return value.toString();
    }
  }

  private getPaymentStateLabel(paymentState: string | undefined): string {
    if (!paymentState || paymentState === '') {
      return this.translate.instant('student.flight.paymentState.PENDING');
    }
    return this.translate.instant('student.flight.paymentState.' + paymentState);
  }

  private filterByDateRange(flights: Flight[], dateRange?: DateRange): Flight[] {
    if (!dateRange) {
      return flights;
    }

    return flights.filter(flight => {
      if (!flight.date) return false;
      const flightDate = new Date(flight.date);
      return flightDate >= dateRange.startDate && flightDate <= dateRange.endDate;
    });
  }

  private filterPassengersByDateRange(passengers: PassengerConfirmation[], dateRange?: DateRange): PassengerConfirmation[] {
    if (!dateRange) {
      return passengers;
    }

    return passengers.filter(passenger => {
      if (!passenger.date) return false;
      const passengerDate = new Date(passenger.date);
      return passengerDate >= dateRange.startDate && passengerDate <= dateRange.endDate;
    });
  }
}
