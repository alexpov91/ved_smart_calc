interface IncotermsInput {
  invoiceValue: number;
  incoterms: string;
  freightToBorder: number;
  insurance: number;
}

/**
 * Adjusts invoice value to CIF-equivalent basis for customs value calculation.
 * All values in same currency as invoice.
 */
export function adjustForIncoterms(input: IncotermsInput): number {
  const { invoiceValue, incoterms, freightToBorder, insurance } = input;

  switch (incoterms.toUpperCase()) {
    case "CIF":
      return invoiceValue;
    case "FOB":
      return invoiceValue + freightToBorder + insurance;
    case "EXW":
      return invoiceValue + freightToBorder + insurance;
    case "DAP":
    case "DDP":
      return invoiceValue;
    case "CPT":
    case "CFR":
      return invoiceValue + insurance;
    default:
      return invoiceValue + freightToBorder + insurance;
  }
}

/**
 * Convert amount to RUB using unit exchange rate.
 * Rounds to 2 decimal places.
 */
export function convertToRub(amount: number, unitRate: number): number {
  return Math.round(amount * unitRate * 100) / 100;
}
