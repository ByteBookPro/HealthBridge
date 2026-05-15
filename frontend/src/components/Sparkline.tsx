import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

type Props = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
};

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const cx = (p0.x + p1.x) / 2;
    d += ` Q ${p0.x} ${p0.y} ${cx} ${(p0.y + p1.y) / 2}`;
    d += ` T ${p1.x} ${p1.y}`;
  }
  return d;
}

export default function Sparkline({
  data, width = 120, height = 40, color = '#2DD4BF', fillColor, strokeWidth = 2.5,
}: Props) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / span) * (height - 4) - 2,
  }));
  const path = smoothPath(points);
  const fillPath = `${path} L ${width} ${height} L 0 ${height} Z`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="sp-fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={fillColor ?? color} stopOpacity={0.35} />
          <Stop offset="1" stopColor={fillColor ?? color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={fillPath} fill="url(#sp-fill)" />
      <Path d={path} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
