export const HEALTH_FACTOR_DISTRIBUTION_RANGES = [
  "<1.0",
  "1.0-1.1",
  "1.1-1.2",
  "1.2-1.5",
  ">1.5",
] as const;

export type HealthFactorDistributionRange =
  (typeof HEALTH_FACTOR_DISTRIBUTION_RANGES)[number];

export type HealthFactorDistributionPoint = {
  range: HealthFactorDistributionRange;
  count: number;
};

export type UserHealthRecordForDistribution = {
  userAddress?: string | null;
  healthFactor?: number | string | null;
  totalBorrowValue?: string | number | null;
};

export function healthFactorDistributionBucket(
  healthFactor: number
): HealthFactorDistributionRange | null {
  if (!Number.isFinite(healthFactor)) return null;
  if (healthFactor < 1.0) return "<1.0";
  if (healthFactor < 1.1) return "1.0-1.1";
  if (healthFactor < 1.2) return "1.1-1.2";
  if (healthFactor <= 1.5) return "1.2-1.5";
  return ">1.5";
}

function parseBorrowValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value);
  return Number.NaN;
}

/**
 * Borrower health-factor histogram for analytics.
 * Counts unique wallets, using the worst (lowest) finite HF among records
 * that have outstanding borrow.
 */
export function buildHealthFactorDistribution(
  records: UserHealthRecordForDistribution[]
): HealthFactorDistributionPoint[] {
  const worstHfByUser = new Map<string, number>();

  for (const record of records) {
    const address = record.userAddress?.trim();
    const hf =
      typeof record.healthFactor === "number"
        ? record.healthFactor
        : typeof record.healthFactor === "string"
          ? Number.parseFloat(record.healthFactor)
          : Number.NaN;
    const borrow = parseBorrowValue(record.totalBorrowValue);
    if (!address || !Number.isFinite(hf) || !(borrow > 0)) {
      continue;
    }

    const current = worstHfByUser.get(address);
    if (current === undefined || hf < current) {
      worstHfByUser.set(address, hf);
    }
  }

  const counts: Record<HealthFactorDistributionRange, number> = {
    "<1.0": 0,
    "1.0-1.1": 0,
    "1.1-1.2": 0,
    "1.2-1.5": 0,
    ">1.5": 0,
  };

  for (const hf of worstHfByUser.values()) {
    const bucket = healthFactorDistributionBucket(hf);
    if (bucket) counts[bucket] += 1;
  }

  return HEALTH_FACTOR_DISTRIBUTION_RANGES.map((range) => ({
    range,
    count: counts[range],
  }));
}
