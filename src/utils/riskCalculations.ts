
export const getRiskColor = (healthFactor: number) => {
  if (healthFactor <= 1.0) return 'text-destructive';
  if (healthFactor <= 1.1) return 'text-yellow-500';
  if (healthFactor <= 1.2) return 'text-whale-gold';
  return 'text-ocean-teal';
};

export const getRiskLevel = (healthFactor: number) => {
  if (healthFactor <= 1.0) return 'CRITICAL';
  if (healthFactor <= 1.1) return 'HIGH RISK';
  if (healthFactor <= 1.2) return 'MODERATE';
  return 'SAFE';
};

export const getRiskVariant = (healthFactor: number) => {
  if (healthFactor <= 1.0) return 'destructive';
  if (healthFactor <= 1.1) return 'secondary';
  return 'outline';
};
