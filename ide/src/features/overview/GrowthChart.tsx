// lightweight-charts removed — using native SVG bar chart

interface GrowthChartProps {
	data: { month: string; value: number }[];
	height?: number;
}

export function GrowthChart({ data, height = 200 }: GrowthChartProps) {
	const maxValue = Math.max(...data.map((d) => d.value), 1);
	const barColors = data.map(
		(_, i) => `hsl(${160 + i * 3}, 60%, ${40 + i * 2}%)`,
	);

	return (
		<div className="w-full h-full" style={{ minHeight: height }}>
			<div
				className="flex items-end gap-1 h-full"
				style={{ paddingBottom: 20 }}
			>
				{data.map((d, i) => (
					<div
						key={d.month}
						className="flex-1 flex flex-col items-center justify-end"
						style={{ height: "100%" }}
					>
						<span className="text-[8px] text-[#4a4b50] font-mono mb-0.5">
							{d.value}
						</span>
						<div
							className="w-full rounded-t-sm transition-all duration-300"
							style={{
								height: `${(d.value / maxValue) * 100}%`,
								minHeight: 2,
								backgroundColor: barColors[i],
							}}
						/>
						<span className="text-[7px] text-[#4a4b50] font-mono mt-1 truncate w-full text-center">
							{d.month}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
