import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import Animated, {
  FadeIn,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { withAlpha } from '../../theme';
import type { AppTheme } from '../../theme';
import { useI18nStore, useT } from '../../i18n';

/**
 * Prop-firm gauges, lifted out of AnalyticsScreen.
 *
 * They were private to a 1500-line screen while being entirely generic: a
 * ring, a bar and a chip that know nothing about challenges. Keeping them
 * there meant the prop-firm tab could not move without dragging them along,
 * and the screen could not shrink.
 *
 * They take `theme` as a prop rather than reading the hook, which is how they
 * were already written -- callers pass the theme they are already holding.
 */

// ─── Animated Progress Ring (SVG) for Prop Firm ───
export const ProgressRing: React.FC<{
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  value: string;
  theme: AppTheme;
  delay?: number;
}> = ({ progress, size = 80, strokeWidth = 8, color, label, value, theme: t, delay = 200 }) => {
  const animProgress = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  useEffect(() => {
    animProgress.value = withDelay(delay, withSpring(clampedProgress, { damping: 18, stiffness: 60 }));
  }, [clampedProgress, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    // We use the animated value in the SVG below
  }));

  const strokeDashoffset = circumference * (1 - animProgress.value);

  return (
    <View style={{ alignItems: 'center', width: 100 }}>
      <Animated.View entering={FadeIn.delay(delay).duration(400)}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={`ringGrad-${label}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="1" />
              <Stop offset="1" stopColor={color} stopOpacity="0.5" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={t.colors.cardBorder}
            strokeWidth={strokeWidth}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#ringGrad-${label})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          <SvgText
            x={size / 2}
            y={size / 2 + 4}
            textAnchor="middle"
            fill={t.colors.textPrimary}
            fontSize={14}
            fontWeight="900"
          >
            {value}
          </SvgText>
        </Svg>
      </Animated.View>
      <Text style={{ color: t.colors.textMuted, fontSize: 9, fontFamily: t.fonts.monoBold, marginTop: 6, letterSpacing: 0.5, textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
};

// ─── Animated Progress Bar for Prop Firm ───
export const AnimatedProgressBar: React.FC<{
  label: string;
  current: number;
  limit: number;
  color: string;
  invert?: boolean;
  theme: AppTheme;
}> = ({ label, current, limit, color, invert = false, theme }) => {
  const { t } = useT();
  const lang = useI18nStore(s => s.lang);
  const pct = limit > 0 ? Math.min(Math.abs(current) / Math.abs(limit), 1) : 0;
  const isWarning = invert ? pct > 0.7 : pct > 0.85;
  const isDanger = invert ? pct > 0.9 : pct > 0.95;
  const barWidth = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withTiming(pct, { duration: 800 });
  }, [pct]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${interpolate(barWidth.value, [0, 1], [0, 100])}%` as any,
  }));

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontFamily: theme.fonts.monoBold, letterSpacing: 0.5 }}>
          {label}
        </Text>
        <Text style={{ color: isDanger ? theme.colors.redLight : isWarning ? theme.colors.goldLight : theme.colors.textPrimary, fontSize: 11, fontFamily: theme.fonts.monoBold, fontVariant: ['tabular-nums'] }}>
          ${Math.abs(current).toLocaleString()} / ${Math.abs(limit).toLocaleString()}
        </Text>
      </View>
      <View style={{ height: 8, backgroundColor: theme.colors.surface, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.cardBorder }}>
        <Animated.View
          style={[
            {
              height: '100%',
              borderRadius: 4,
              backgroundColor: isDanger ? theme.colors.red : isWarning ? theme.colors.gold : color,
            },
            barStyle,
          ]}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 8, fontFamily: theme.fonts.mono }}>
          {invert ? (pct > 0.9 ? t('progressAlert') : pct > 0.7 ? t('progressWarning') : t('progressSafe')) : (pct > 0.95 ? t('progressAlmost') : pct > 0.85 ? t('progressOngoing') : t('progressAdvancing'))}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 8, fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] }}>
          {(pct * 100).toFixed(1)}%
        </Text>
      </View>
    </View>
  );
};

// ─── Mini Status Chip ───
export const StatusChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  theme: AppTheme;
  delay?: number;
}> = ({ icon, label, value, color, theme: t, delay = 0 }) => (
  <Animated.View
    entering={FadeIn.delay(delay).duration(350)}
    style={{
      backgroundColor: t.colors.surface,
      borderColor: t.colors.cardBorder,
      borderWidth: 1,
      borderRadius: 10,
      padding: 10,
      flex: 1,
      alignItems: 'center',
      gap: 4,
    }}
  >
    {icon}
    <Text style={{ color: t.colors.textMuted, fontSize: 8, fontFamily: t.fonts.monoBold, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Text>
    <Text style={{ color, fontSize: 14, fontFamily: t.fonts.monoBold, fontVariant: ['tabular-nums'] }}>{value}</Text>
  </Animated.View>
);
