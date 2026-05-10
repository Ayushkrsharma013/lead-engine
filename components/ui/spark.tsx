import * as React from "react";

interface SparkProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

export function Spark({
  data,
  color,
  height = 28,
  width = 96,
}: SparkProps) {
  const strokeColor = color || "var(--accent)";

  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pad = 2;
  const chartH = height - pad * 2;
  const chartW = width - pad * 2;
  const stepX = chartW / (data.length - 1);

  const pts = data.map((v, i) => ({
    x: pad + i * stepX,
    y: pad + chartH - ((v - min) / range) * chartH,
  }));

  const lineD = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const last = pts[pts.length - 1];
  const areaD = `${lineD} L${last.x},${pad + chartH} L${pts[0].x},${pad + chartH} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={areaD} fill={strokeColor} fillOpacity={0.1} />
      <path
        d={lineD}
        stroke={strokeColor}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={2} fill={strokeColor} />
    </svg>
  );
}
