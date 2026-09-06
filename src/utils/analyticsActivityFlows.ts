export interface FlowDataPoint {
  date: string;
  inflow: number;
  outflow: number;
  netflow: number;
}

export function aggregateEventsByDay<T extends { timestamp: number }>(
  events: T[],
  getUsd: (event: T) => number
): Record<string, number> {
  const daily: Record<string, number> = {};
  for (const event of events) {
    const date = new Date(event.timestamp).toISOString().split("T")[0];
    daily[date] = (daily[date] || 0) + getUsd(event);
  }
  return daily;
}

export function mergeDailyFlows(
  inflowByDay: Record<string, number>,
  outflowByDay: Record<string, number>
): FlowDataPoint[] {
  const dates = new Set([
    ...Object.keys(inflowByDay),
    ...Object.keys(outflowByDay),
  ]);

  return Array.from(dates)
    .sort()
    .map((date) => {
      const inflow = inflowByDay[date] || 0;
      const outflowMagnitude = outflowByDay[date] || 0;
      return {
        date,
        inflow,
        outflow: outflowMagnitude === 0 ? 0 : -outflowMagnitude,
        netflow: inflow - outflowMagnitude,
      };
    });
}

export function symmetricYDomain(
  data: FlowDataPoint[],
  padding = 1.1
): [number, number] {
  if (data.length === 0) return [-5000, 5000];

  const values = data.flatMap((point) => [
    point.inflow,
    point.outflow,
    point.netflow,
  ]);
  const maxAbs = Math.max(...values.map(Math.abs), 1);
  const bound = maxAbs * padding;
  return [-bound, bound];
}
