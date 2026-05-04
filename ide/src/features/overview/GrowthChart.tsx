import { useEffect, useRef } from 'react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';

interface GrowthChartProps {
  data: { month: string; value: number }[];
  height?: number;
}

export function GrowthChart({ data, height = 200 }: GrowthChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !data.length) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#4a4b50',
        fontSize: 10,
        fontFamily: 'ui-monospace, monospace',
      },
      grid: {
        vertLines: { color: '#2d2e32', style: 2 },
        horzLines: { color: '#2d2e32', style: 2 },
      },
      crosshair: {
        vertLine: { color: '#10b981', width: 1, style: 2 },
        horzLine: { color: '#10b981', width: 1, style: 2 },
      },
      timeScale: {
        borderColor: '#2d2e32',
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: '#2d2e32',
      },
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#10b981',
      topColor: 'rgba(16, 185, 129, 0.2)',
      bottomColor: 'rgba(16, 185, 129, 0.01)',
      lineWidth: 2,
    });

    const chartData = data.map((d, i) => ({
      time: i as unknown as import('lightweight-charts').Time,
      value: d.value,
    }));

    areaSeries.setData(chartData);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
    };
  }, [data, height]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[200px] bg-[#0a0a0c] rounded text-[10px] text-[#4a4b50] font-mono">
        No growth data available
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" />;
}
