import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';

interface TraderRadarDnaChartProps {
  stats: {
    discipline: number; // 0 to 100 (% plan respected)
    patience: number;   // 0 to 100 (win rate on high TF / timing)
    riskControl: number; // 0 to 100 (100 - drawdown severity)
    psychology: number;  // 0 to 100 (lack of FOMO/revenge)
    consistency: number; // 0 to 100 (profit factor score)
  };
  size?: number;
}

export const TraderRadarDnaChart: React.FC<TraderRadarDnaChartProps> = ({
  stats,
  size = Dimensions.get('window').width - 64,
}) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;

  const axes = [
    { key: 'discipline', label: t('chartAxisDiscipline'), value: Math.min(Math.max(stats.discipline, 15), 100) },
    { key: 'riskControl', label: t('chartAxisRiskControl'), value: Math.min(Math.max(stats.riskControl, 15), 100) },
    { key: 'consistency', label: t('chartAxisConsistency'), value: Math.min(Math.max(stats.consistency, 15), 100) },
    { key: 'psychology', label: t('chartAxisPsychology'), value: Math.min(Math.max(stats.psychology, 15), 100) },
    { key: 'patience', label: t('chartAxisPatience'), value: Math.min(Math.max(stats.patience, 15), 100) },
  ];

  const numAxes = axes.length;
  const angleStep = (Math.PI * 2) / numAxes;

  // Concentric Rings (25%, 50%, 75%, 100%)
  const rings = [0.25, 0.5, 0.75, 1.0];

  const ringPolygons = rings.map(r => {
    const points = axes.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = cx + radius * r * Math.cos(angle);
      const y = cy + radius * r * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
    return points;
  });

  // Data Polygon
  const dataPoints = axes.map((a, i) => {
    const ratio = a.value / 100;
    const angle = i * angleStep - Math.PI / 2;
    const x = cx + radius * ratio * Math.cos(angle);
    const y = cy + radius * ratio * Math.sin(angle);
    return { x, y, str: `${x},${y}`, value: a.value };
  });

  const dataPolygonStr = dataPoints.map(p => p.str).join(' ');

  // Global Score (Average of 5 axes)
  const globalScore = Math.round(
    axes.reduce((acc, a) => acc + a.value, 0) / numAxes
  );

  return (
    <View style={[styles.container, { width: size, height: size + 20 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('chartRadarDnaTitle')}</Text>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{t('chartRadarScore', globalScore)}</Text>
        </View>
      </View>

      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="radarGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.colors.primaryLight} stopOpacity="0.55" />
            <Stop offset="1" stopColor={theme.colors.cyan} stopOpacity="0.25" />
          </LinearGradient>
        </Defs>

        {/* Background Grid Rings */}
        {ringPolygons.map((pts, i) => (
          <Polygon
            key={i}
            points={pts}
            fill="transparent"
            stroke={theme.colors.cardBorder}
            strokeWidth="1"
            strokeDasharray={i < 3 ? '2 2' : undefined}
          />
        ))}

        {/* Radial Axis Lines */}
        {axes.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);
          return (
            <Line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke={theme.colors.borderBright}
              strokeWidth="1"
            />
          );
        })}

        {/* Active Data Filled Polygon */}
        <Polygon
          points={dataPolygonStr}
          fill="url(#radarGrad)"
          stroke={theme.colors.primaryLight}
          strokeWidth="2"
        />

        {/* Data Vertices Dots */}
        {dataPoints.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4.5}
            fill={theme.colors.cyan}
            stroke={theme.colors.card}
            strokeWidth="1.5"
          />
        ))}

        {/* Axis Labels Around Radar */}
        {axes.map((a, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const labelRadius = radius + 24;
          const x = cx + labelRadius * Math.cos(angle);
          const y = cy + labelRadius * Math.sin(angle);

          return (
            <SvgText
              key={a.key}
              x={x}
              y={y + 3}
              fill={theme.colors.textSecondary}
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {a.label} ({Math.round(a.value)}%)
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.chartBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    title: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },
    scoreBadge: {
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      borderColor: theme.colors.primary,
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    scoreText: {
      color: theme.colors.primaryLight,
      fontSize: 8,
      fontFamily: theme.fonts.monoBold,
    },
  });
