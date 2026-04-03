export interface NormalizedItem {
  id: string;
  tnvedCode: string;
  productName: string;
  invoiceValue: number;          // in original currency
  currency: string;
  incoterms: string;
  country: string;
  weightNet: number;             // kg
  weightGross: number;           // kg
  quantity: number;
  unit: string;
}

export interface TariffSnapshot {
  tnvedCode: string;
  dutyType: "advalorem" | "specific" | "combined";
  dutyRate: number;              // % for advalorem
  dutySpecific?: number;         // €/unit for specific
  dutyUnit?: string;             // kg, pcs, pair
  vatRate: number;               // 22, 10, or 0
  needsCertification: boolean;
  needsMarking: boolean;
  source: "TKS" | "TWS";
  fetchedAt: number;
}

export interface FxSnapshot {
  currency: string;
  unitRate: number;              // RUB per 1 unit of currency
  date: string;
}

export interface CustomsFeeScale {
  minValue: number;
  maxValue: number;
  fee: number;
}

export interface AntidumpingMatch {
  rate: number;                  // % of customs value
  country: string;
}

export interface ExciseMatch {
  ratePerUnit: number;           // RUB per unit
  unit: string;
  productCategory: string;
}

export interface ShipmentLogistics {
  freight: number;               // in freightCurrency
  freightCurrency: string;
  insurance?: number;            // absolute amount in freightCurrency
  insuranceAuto?: boolean;       // if true, auto 0.5% of invoice value
  broker?: number;               // RUB
  certification?: number;        // RUB
  marking?: number;              // RUB
  bankCommission?: number;       // RUB
  svh?: number;                  // RUB
  transportAfterBorder?: number; // RUB
}

export interface CalculationInput {
  items: NormalizedItem[];
  tariffs: Map<string, TariffSnapshot>;       // keyed by tnvedCode
  fxRates: Map<string, FxSnapshot>;           // keyed by currency
  eurRate: FxSnapshot;                         // EUR rate for specific duties
  customsFeeScale: CustomsFeeScale[];
  antidumping: Map<string, AntidumpingMatch>;  // keyed by item id
  excise: Map<string, ExciseMatch>;            // keyed by item id
  logistics: ShipmentLogistics;
  distributionMethod: "by_weight" | "by_value";
}

export interface ItemResult {
  itemId: string;
  customsValue: number;          // RUB
  duty: number;
  antidumping: number;
  excise: number;
  vat: number;
  customsFee: number;            // item's share of shipment fee
  totalCustoms: number;
  landedCost: number;
  landedCostPerUnit: number;
  allocatedFreight?: number;     // RUB — freight share allocated to this item
  allocatedInsurance?: number;   // RUB — insurance share allocated to this item
}

export interface CalculationOutput {
  itemResults: ItemResult[];
  totals: {
    customsValue: number;
    duty: number;
    antidumping: number;
    excise: number;
    vat: number;
    customsFee: number;
    totalCustoms: number;
    landedCost: number;
  };
  warnings: Warning[];
  errors: EngineError[];
}

export interface Warning {
  code: string;
  level: "info" | "warning" | "critical";
  message: string;
  itemId?: string;
}

export interface EngineError {
  code: string;
  message: string;
  itemId?: string;
}

export interface ReverseInput {
  item: NormalizedItem;
  tariff: TariffSnapshot;
  fxRate: FxSnapshot;
  eurRate: FxSnapshot;
  customsFeeScale: CustomsFeeScale[];
  antidumping?: AntidumpingMatch;
  excise?: ExciseMatch;
  logistics: ShipmentLogistics;
  retailPrice: number;           // RUB
  desiredMargin: number;         // %
}

export interface ReverseOutput {
  maxPurchasePrice: number;      // in original currency
  itemResult: ItemResult;
  warnings: Warning[];
  converged: boolean;
  iterations: number;
}
