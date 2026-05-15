import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { theme } from '@/src/theme/theme';
import AppText from './AppText';

interface TrendChartProps {
  data: { date: string; value: number }[];
  color: string;
  height?: number;
  showLabels?: boolean;
  showGrid?: boolean;
}

export default function TrendChart({
  data,
  color,
  height = 120,
  showLabels = true,
  showGrid = true,
}: TrendChartProps) {
  const width = Dimensions.get('window').width - 64;
  const padding = { top: 10, right: 10, bottom: showLabels ? 20 : 10, left: showLabels ? 40 : 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (data.length < 2) {
    return (
      <View style={[styles.container, { height }]}>
        <AppText size={12} color={theme.colors.textMute} style={{ textAlign: 'center' }}>
          Not enough data
        </AppText>
      </View>
    );
  }

  const values = data.map(d => d.value);
  const minValue = Math.min(...values) * 0.95;
  const maxValue = Math.max(...values) * 1.05;
  const valueRange = maxValue - minValue || 1;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartWidth,
    y: padding.top + chartHeight - ((d.value - minValue) / valueRange) * chartHeight,
  }));

  // Create smooth curve path
  const linePath = points.reduce((path, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    const prev = points[i - 1];
    const cpx1 = prev.x + (point.x - prev.x) / 3;
    const cpx2 = prev.x + (2 * (point.x - prev.x)) / 3;
    return `${path} C ${cpx1} ${prev.y} ${cpx2} ${point.y} ${point.x} ${point.y}`;
  }, '');

  // Create fill path
  const fillPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

  // Grid lines
  const gridLines = 4;
  const gridY = Array.from({ length: gridLines }, (_, i) =>
    padding.top + (i / (gridLines - 1)) * chartHeight
  );

  // X-axis labels (first, middle, last)
  const xLabels = [
    { x: padding.left, label: formatDate(data[0].date) },
    { x: padding.left + chartWidth / 2, label: formatDate(data[Math.floor(data.length / 2)].date) },
    { x: padding.left + chartWidth, label: formatDate(data[data.length - 1].date) },
  ];

  // Y-axis labels
  const yLabels = gridY.map((y, i) => ({
    y,
    label: formatValue(maxValue - (i / (gridLines - 1)) * valueRange),
  }));

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.3" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {showGrid &&
          gridY.map((y, i) => (
            <Line
              key={i}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4,4"
            />
          ))}

        {/* Fill area */}
        <Path d={fillPath} fill="url(#chartFill)" />

        {/* Line */}
        <Path d={linePath} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />

        {/* Current value dot */}
        <Circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={4}
          fill={color}
        />
        <Circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={8}
          fill={color}
          opacity={0.3}
        />

        {/* Y-axis labels */}
        {showLabels &&
          yLabels.map((item, i) => (
            <SvgText
              key={i}
              x={padding.left - 8}
              y={item.y + 4}
              fontSize={9}
              fill="rgba(255,255,255,0.5)"
              textAnchor="end"
            >
              {item.label}
            </SvgText>
          ))}

        {/* X-axis labels */}
        {showLabels &&
          xLabels.map((item, i) => (
            <SvgText
              key={i}
              x={item.x}
              y={height - 4}
              fontSize={9}
              fill="rgba(255,255,255,0.5)"
              textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
            >
              {item.label}
            </SvgText>
          ))}
      </Svg>
    </View>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatValue(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return Math.round(value).toString();
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
