import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../../theme';
import { duration, easing } from '../../theme/motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Colour override; defaults to green/red based on net direction. */
  color?: string;
  /** Fill the area under the line. */
  filled?: boolean;
  strokeWidth?: number;
}

/**
 * Sparkline — a trend line with no axes, no labels, no chrome.
 *
 * Built for inline use next to a metric: it answers "which way is this going"
 * in the space of a word. The line draws itself left-to-right on mount using
 * stroke-dash offset, so the motion traces the data rather than fading it in.
 */
export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 72,
  height = 24,
  color,
  filled = true,
  strokeWidth = 1.5,
}) => {
  const { theme } = useTheme();
  const progress = useSharedValue(0);

  const net = data.length ? data[data.length - 1] - data[0] : 0;
  const stroke = color ?? (net >= 0 ? theme.colors.green : theme.colors.red);

  const { linePath, areaPath, lastPoint, length } = useMemo(() => {
    if (data.length < 2) {
      return { linePath: '', areaPath: '', lastPoint: null, length: 0 };
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const pad = strokeWidth + 1;
    const h = height - pad * 2;

    const pts = data.map((v, i) => ({
      x: (i / (data.length - 1)) * width,
      y: pad + h - ((v - min) / span) * h,
    }));

    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

    // Approximate path length for the dash reveal.
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }

    return {
      linePath: d,
      areaPath: `${d} L${width},${height} L0,${height} Z`,
      lastPoint: pts[pts.length - 1],
      length: Math.ceil(len),
    };
  }, [data, width, height, strokeWidth]);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: duration.slow, easing: easing.out });
  }, [linePath, progress]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - progress.value),
  }));

  const areaProps = useAnimatedProps(() => ({
    opacity: progress.value * 0.9,
  }));

  if (!linePath) return <View style={{ width, height }} />;

  const gid = `spark-${stroke.replace('#', '')}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {filled ? (
        <AnimatedPath d={areaPath} fill={`url(#${gid})`} animatedProps={areaProps} />
      ) : null}

      <AnimatedPath
        d={linePath}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={length}
        animatedProps={lineProps}
      />

      {lastPoint ? (
        <Circle cx={lastPoint.x} cy={lastPoint.y} r={strokeWidth + 0.8} fill={stroke} />
      ) : null}
    </Svg>
  );
};
