import { useEffect, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { PricePoint, PriceToBeat } from "@/features/longShort/types";

type LiveMarketChartProps = {
  historical: PricePoint[];
  priceToBeat: PriceToBeat | null;
  height?: number;
  className?: string;
};

/**
 * TradingView Lightweight Charts area series with frozen Price-to-Beat line.
 */
export function LiveMarketChart({
  historical,
  priceToBeat,
  height = 360,
  className,
}: LiveMarketChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLineRef = useRef<ReturnType<ISeriesApi<"Area">["createPriceLine"]> | null>(
    null
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94A3B8",
        fontFamily: "inherit",
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" },
      },
      rightPriceScale: {
        borderColor: "rgba(148,163,184,0.2)",
      },
      timeScale: {
        borderColor: "rgba(148,163,184,0.2)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(0,163,158,0.45)" },
        horzLine: { color: "rgba(0,163,158,0.45)" },
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#00A39E",
      topColor: "rgba(0,163,158,0.35)",
      bottomColor: "rgba(0,163,158,0.02)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, []);

    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(el);
    chart.applyOptions({ width: el.clientWidth });

    return () => {
      ro.disconnect();
      markersRef.current = null;
      priceLineRef.current = null;
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [height]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const data = historical
      .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
      .map((p) => ({
        time: p.time as UTCTimestamp,
        value: Number(p.value),
      }));

    series.setData(data);

    if (data.length > 0) {
      const last = data[data.length - 1];
      const markers: SeriesMarker<Time>[] = [
        {
          time: last.time,
          position: "inBar",
          color: "#4ADE80",
          shape: "circle",
          size: 1.2,
        },
      ];
      markersRef.current?.setMarkers(markers);
      chart.timeScale().scrollToRealTime();
    } else {
      markersRef.current?.setMarkers([]);
    }
  }, [historical]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (priceLineRef.current) {
      series.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }

    if (priceToBeat == null || !Number.isFinite(Number(priceToBeat))) return;

    priceLineRef.current = series.createPriceLine({
      price: Number(priceToBeat),
      color: "#F0B800",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `Target $${Number(priceToBeat).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    });
  }, [priceToBeat]);

  return (
    <div
      className={className}
      style={{ height }}
      ref={containerRef}
      aria-label="Live asset price chart"
    />
  );
}
