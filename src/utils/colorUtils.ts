
export const getRiskColor = (riskLevel: string, theme: 'light' | 'dark' = 'light'): string => {
  const colors = {
    light: {
      liquidatable: 'hsl(var(--destructive))',
      danger: '#ea580c',
      moderate: '#eab308',
      safe: '#16a34a',
    },
    dark: {
      liquidatable: 'hsl(var(--destructive))',
      danger: '#fb923c',
      moderate: '#fbbf24',
      safe: '#22c55e',
    }
  };
  
  return colors[theme][riskLevel as keyof typeof colors.light] || colors[theme].safe;
};

export const getHealthFactorColorClass = (healthFactor: number | null): string => {
  if (healthFactor === null) return 'text-gray-500';
  if (healthFactor <= 1.05) return 'text-destructive';
  if (healthFactor <= 1.2) return 'text-orange-500';
  if (healthFactor <= 1.5) return 'text-yellow-500';
  return 'text-green-500';
};
