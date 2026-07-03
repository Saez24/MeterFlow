import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function maxDecimalPlaces(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (
      control.value === null ||
      control.value === undefined ||
      control.value === ''
    ) {
      return null;
    }
    const valueStr = String(control.value).replace(',', '.');
    const parts = valueStr.split('.');
    if (parts.length > 1 && parts[1].length > max) {
      return { maxDecimalPlaces: { required: max, actual: parts[1].length } };
    }
    return null;
  };
}
