import { Pipe, PipeTransform } from '@angular/core';
import { getValue, TranslateService } from '@ngx-translate/core';

@Pipe({
    name: 'nxgTransalteSort',
    standalone: true
})
export class NxgTransalteSortPipe implements PipeTransform {

  constructor(
    private translate: TranslateService
  ) {}

  transform(value: any[], ...args: unknown[]): any[] {
    if (value === null || value === undefined) {
      return value;
    }
    return value.sort((a, b) => {
      if (isNaN(this.order(args[0], b.key))) {
        return -1;
      }
      return this.order(args[0], a.key) - this.order(args[0], b.key);
    });
  }

  /**
   * `controlSheet.<group>.<key>.order` is a number in the i18n bundles, and
   * ngx-translate 18's `instant()` returns undefined for a number. So it is read
   * from the raw bundle - current language first, then the fallback, as
   * instant() would.
   */
  private order(group: unknown, key: string): number {
    const path = `controlSheet.${group}.${key}.order`;
    for (const lang of [this.translate.getCurrentLang(), this.translate.getFallbackLang()]) {
      const value = lang ? getValue(this.translate.getTranslations(lang), path) : undefined;
      if (value !== undefined && value !== null) {
        return parseInt(String(value));
      }
    }
    return NaN;
  }

}
