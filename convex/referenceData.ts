import { query } from "./_generated/server";

// Also serves as currencies.listSupported (consolidated per spec)
export const getCalculationMeta = query({
  args: {},
  handler: async () => {
    return {
      incoterms: ["EXW", "FOB", "CIF", "DAP", "DDP", "CPT", "CFR"],
      currencies: ["USD", "EUR", "CNY", "TRY", "GBP"],
      units: ["шт", "кг", "пара", "литр", "м", "м²", "м³"],
      countries: [
        { code: "CN", name: "Китай" },
        { code: "TR", name: "Турция" },
        { code: "DE", name: "Германия" },
        { code: "IT", name: "Италия" },
        { code: "FR", name: "Франция" },
        { code: "KR", name: "Южная Корея" },
        { code: "JP", name: "Япония" },
        { code: "IN", name: "Индия" },
        { code: "VN", name: "Вьетнам" },
        { code: "US", name: "США" },
        { code: "GB", name: "Великобритания" },
        { code: "BY", name: "Беларусь" },
        { code: "KZ", name: "Казахстан" },
        { code: "UZ", name: "Узбекистан" },
        { code: "TH", name: "Таиланд" },
        { code: "ID", name: "Индонезия" },
      ],
      distributionMethods: [
        { value: "by_weight", label: "По весу" },
        { value: "by_value", label: "По стоимости" },
      ],
    };
  },
});
