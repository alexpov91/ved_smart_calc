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
    // Group C: freight + insurance included
    case "CIF":
    case "CIP":
      return invoiceValue;
    // Group C: freight included, no insurance
    case "CFR":
    case "CPT":
      return invoiceValue + insurance;
    // Group F: no freight, no insurance
    case "EXW":
    case "FCA":
    case "FAS":
    case "FOB":
      return invoiceValue + freightToBorder + insurance;
    // Group D: delivery included
    case "DAP":
    case "DPU":
    case "DDP":
      return invoiceValue;
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
