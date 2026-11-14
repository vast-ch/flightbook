import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { TCreatedPdf } from 'pdfmake/build/pdfmake';

@Injectable({
  providedIn: 'root'
})
export class PdfOpenService {

  constructor(private snackBar: MatSnackBar, private translate: TranslateService) { }

  /**
   * Opens a generated PDF in a new tab.
   *
   * Callers build the PDF after an `await` (loading data), so the original click no longer counts as a
   * user gesture and Safari (macOS and iOS) blocks the new window: pdfmake then throws. In that case we
   * ask "Export is ready, open it?" - the tap on "Open" is a fresh gesture the browser allows. Only if
   * even that is blocked do we fall back to downloading the file.
   */
  open(pdf: TCreatedPdf, fileName: string) {
    try {
      pdf.open();
    } catch {
      const snackBarRef = this.snackBar.open(this.translate.instant('message.exportReady'), this.translate.instant('buttons.open'), {
        horizontalPosition: 'center',
        verticalPosition: 'top',
      });
      // onAction fires synchronously inside the click handler, so pdf.open() still runs within the tap.
      snackBarRef.onAction().subscribe(() => {
        try {
          pdf.open();
        } catch {
          this.download(pdf, fileName);
        }
      });
    }
  }

  private download(pdf: TCreatedPdf, fileName: string) {
    pdf.download(fileName);
    this.snackBar.open(this.translate.instant('message.pdfDownloaded'), this.translate.instant('buttons.done'), {
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}
