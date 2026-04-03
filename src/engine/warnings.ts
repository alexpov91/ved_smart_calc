import type { Warning, TariffSnapshot } from "./types";

interface WarningInput {
  itemId: string;
  tariff: TariffSnapshot;
  staleTariff: boolean;
  fxDateMismatch: boolean;
  fxWarning?: string;
}

export function generateWarnings(input: WarningInput): Warning[] {
  const { itemId, tariff, staleTariff, fxDateMismatch, fxWarning } = input;
  const warnings: Warning[] = [];

  if (tariff.needsCertification) {
    warnings.push({
      code: "CERT_REQUIRED",
      level: "info",
      message: `Код ${tariff.tnvedCode} может требовать сертификацию`,
      itemId,
    });
  }

  if (tariff.needsMarking) {
    warnings.push({
      code: "MARKING_REQUIRED",
      level: "info",
      message: `Код ${tariff.tnvedCode} требует маркировку «Честный знак»`,
      itemId,
    });
  }

  if (staleTariff) {
    warnings.push({
      code: "STALE_TARIFF",
      level: "warning",
      message: `Тариф для ${tariff.tnvedCode} может быть неактуальным`,
      itemId,
    });
  }

  if (fxDateMismatch && fxWarning) {
    warnings.push({
      code: "FX_DATE_MISMATCH",
      level: "warning",
      message: fxWarning,
      itemId,
    });
  }

  return warnings;
}
