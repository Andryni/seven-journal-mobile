import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Path, Rect, Line, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  onAnimationFinish: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ onAnimationFinish }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Master fade out
  const containerFade = useRef(new Animated.Value(1)).current;

  // Background Grid Opacity
  const gridOpacity = useRef(new Animated.Value(0)).current;

  // Candlesticks Animation (3 candlesticks: SL sweep, Rejection, Bullish Expansion)
  const candle1Height = useRef(new Animated.Value(0)).current;
  const candle2Height = useRef(new Animated.Value(0)).current;
  const candle3Height = useRef(new Animated.Value(0)).current;
  const candlesOpacity = useRef(new Animated.Value(0)).current;

  // Equity Curve Neon Stroke
  const equityProgress = useRef(new Animated.Value(0)).current;
  const equityGlow = useRef(new Animated.Value(0)).current;

  // Pulse point at the tip of the equity line
  const tipPulse = useRef(new Animated.Value(0.6)).current;

  // Typography animations
  const sevenOpacity = useRef(new Animated.Value(0)).current;
  const sevenScale = useRef(new Animated.Value(0.92)).current;
  const journalOpacity = useRef(new Animated.Value(0)).current;
  const journalY = useRef(new Animated.Value(15)).current;

  // Subtitle / Terminal Typewriter
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const [taglineIndex, setTaglineIndex] = useState(0);
  const TAGLINE = 'QUANTITATIVE TRADING JOURNAL';

  // Live Market Ticker footer
  const tickerOpacity = useRef(new Animated.Value(0)).current;
  const tickerTranslateX = useRef(new Animated.Value(0)).current;

  // Status Badge / Lock Guard verification
  const statusOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ── Phase 1: Background Market Grid fades in ──
    const p1Grid = Animated.timing(gridOpacity, {
      toValue: 0.45,
      duration: 400,
      useNativeDriver: true,
    });

    // ── Phase 2: Candlesticks sequential draw ──
    const p2Candles = Animated.parallel([
      Animated.timing(candlesOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.stagger(120, [
        Animated.spring(candle1Height, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
        Animated.spring(candle2Height, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
        Animated.spring(candle3Height, { toValue: 1, friction: 5, tension: 45, useNativeDriver: true }),
      ]),
    ]);

    // ── Phase 3: Glowing Equity Curve draws ──
    const p3Equity = Animated.parallel([
      Animated.timing(equityProgress, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(equityGlow, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]);

    // ── Phase 4: Brand Reveal ("SEVEN" + "JOURNAL") ──
    const p4Brand = Animated.parallel([
      Animated.spring(sevenScale, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
      Animated.timing(sevenOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(journalY, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
      Animated.timing(journalOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]);

    // ── Phase 5: Tagline & Status Badge ──
    const p5Status = Animated.parallel([
      Animated.timing(taglineOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(statusOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(tickerOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]);

    // ── Phase 6: Exit Transition ──
    const p6Exit = Animated.parallel([
      Animated.timing(containerFade, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(sevenScale, { toValue: 1.05, duration: 400, useNativeDriver: true }),
    ]);

    // Run main sequence
    Animated.sequence([
      p1Grid,
      p2Candles,
      p3Equity,
      p4Brand,
      p5Status,
      Animated.delay(1000),
      p6Exit,
    ]).start(() => {
      onAnimationFinish();
    });

    // Typewriter timer for subtitle
    const typeTimer = setTimeout(() => {
      let idx = 0;
      const interval = setInterval(() => {
        idx++;
        setTaglineIndex(idx);
        if (idx >= TAGLINE.length) clearInterval(interval);
      }, 35);
      return () => clearInterval(interval);
    }, 900);

    // Continuous pulsing loop on equity tip point
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(tipPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(tipPulse, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseAnim.start();

    // Continuous ticker horizontal scrolling
    const tickerAnim = Animated.loop(
      Animated.timing(tickerTranslateX, {
        toValue: -150,
        duration: 4000,
        useNativeDriver: true,
      })
    );
    tickerAnim.start();

    return () => {
      pulseAnim.stop();
      tickerAnim.stop();
      clearTimeout(typeTimer);
    };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerFade }]}>
      {/* Background ambient radial glow */}
      <View style={styles.ambientGlow} />

      {/* Grid Pattern (Trading Desk Background) */}
      <Animated.View style={[styles.gridWrap, { opacity: gridOpacity }]} pointerEvents="none">
        <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="gridGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#6366F1" stopOpacity="0.12" />
              <Stop offset="50%" stopColor="#10B981" stopOpacity="0.06" />
              <Stop offset="100%" stopColor="#000" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {/* Horizontal grid lines */}
          {[0.2, 0.35, 0.5, 0.65, 0.8].map((ratio, i) => (
            <Line
              key={`h-${i}`}
              x1={0}
              y1={SCREEN_H * ratio}
              x2={SCREEN_W}
              y2={SCREEN_H * ratio}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="4,6"
              strokeWidth="1"
            />
          ))}
          {/* Vertical grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio, i) => (
            <Line
              key={`v-${i}`}
              x1={SCREEN_W * ratio}
              y1={0}
              x2={SCREEN_W * ratio}
              y2={SCREEN_H}
              stroke="rgba(255,255,255,0.04)"
              strokeDasharray="4,6"
              strokeWidth="1"
            />
          ))}
        </Svg>
      </Animated.View>

      {/* Main Visual Center: Trading Candles + Neon Equity Arc */}
      <View style={styles.centerStage}>
        {/* Candlesticks Visualization */}
        <Animated.View style={[styles.candlesRow, { opacity: candlesOpacity }]}>
          {/* Candle 1 (Bearish Pullback / Sweep) */}
          <Animated.View style={[styles.candleItem, { transform: [{ scaleY: candle1Height }] }]}>
            <View style={[styles.candleWick, { height: 36, backgroundColor: 'rgba(239, 68, 68, 0.6)' }]} />
            <View style={[styles.candleBody, { height: 18, backgroundColor: '#EF4444' }]} />
          </Animated.View>

          {/* Candle 2 (Doji / Rejection) */}
          <Animated.View style={[styles.candleItem, { transform: [{ scaleY: candle2Height }] }]}>
            <View style={[styles.candleWick, { height: 44, backgroundColor: 'rgba(245, 158, 11, 0.6)' }]} />
            <View style={[styles.candleBody, { height: 6, backgroundColor: '#F59E0B' }]} />
          </Animated.View>

          {/* Candle 3 (Strong Bullish Expansion) */}
          <Animated.View style={[styles.candleItem, { transform: [{ scaleY: candle3Height }] }]}>
            <View style={[styles.candleWick, { height: 56, backgroundColor: 'rgba(16, 185, 129, 0.6)' }]} />
            <View style={[styles.candleBody, { height: 32, backgroundColor: '#10B981' }]} />
          </Animated.View>
        </Animated.View>

        {/* Brand Reveal : SEVEN JOURNAL */}
        <View style={styles.brandBlock}>
          {/* SEVEN */}
          <Animated.View
            style={[
              styles.sevenWrap,
              {
                opacity: sevenOpacity,
                transform: [{ scale: sevenScale }],
              },
            ]}
          >
            <Text style={styles.brandSeven}>SEVEN</Text>
          </Animated.View>

          {/* JOURNAL */}
          <Animated.View
            style={[
              styles.journalWrap,
              {
                opacity: journalOpacity,
                transform: [{ translateY: journalY }],
              },
            ]}
          >
            <Text style={styles.brandJournal}>JOURNAL</Text>
          </Animated.View>
        </View>

        {/* Dynamic Typewriter Subtitle */}
        <Animated.View style={[styles.taglineBox, { opacity: taglineOpacity }]}>
          <Text style={styles.taglineText}>
            {TAGLINE.slice(0, taglineIndex)}
            {taglineIndex < TAGLINE.length && <Text style={styles.cursor}>▌</Text>}
          </Text>
        </Animated.View>

        {/* Terminal Loading Indicators */}
        <Animated.View style={[styles.statusRow, { opacity: statusOpacity }]}>
          <View style={styles.statusChip}>
            <Animated.View style={[styles.statusDot, { opacity: tipPulse }]} />
            <Text style={styles.statusText}>EDGE ENGINE READY</Text>
          </View>
          <View style={[styles.statusChip, { borderColor: 'rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
            <Text style={[styles.statusText, { color: '#34D399' }]}>DISCIPLINE 100%</Text>
          </View>
        </Animated.View>
      </View>

      {/* Footer Market Ticker */}
      <Animated.View style={[styles.tickerFooter, { opacity: tickerOpacity }]}>
        <Animated.View style={[styles.tickerScroll, { transform: [{ translateX: tickerTranslateX }] }]}>
          <Text style={styles.tickerItem}>XAUUSD <Text style={styles.greenText}>+1.42%</Text></Text>
          <Text style={styles.tickerSeparator}>•</Text>
          <Text style={styles.tickerItem}>NASDAQ <Text style={styles.greenText}>+0.85%</Text></Text>
          <Text style={styles.tickerSeparator}>•</Text>
          <Text style={styles.tickerItem}>EURUSD <Text style={styles.redText}>-0.18%</Text></Text>
          <Text style={styles.tickerSeparator}>•</Text>
          <Text style={styles.tickerItem}>US30 <Text style={styles.greenText}>+0.41%</Text></Text>
          <Text style={styles.tickerSeparator}>•</Text>
          <Text style={styles.tickerItem}>RISK GUARD <Text style={styles.goldText}>ARMED</Text></Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#060709',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 99999,
    },
    ambientGlow: {
      position: 'absolute',
      width: SCREEN_W * 1.2,
      height: SCREEN_W * 1.2,
      borderRadius: (SCREEN_W * 1.2) / 2,
      backgroundColor: 'rgba(99, 102, 241, 0.08)',
    },
    gridWrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    centerStage: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    candlesRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 16,
      height: 70,
      marginBottom: 20,
    },
    candleItem: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 14,
    },
    candleWick: {
      position: 'absolute',
      width: 2,
      borderRadius: 1,
    },
    candleBody: {
      width: 12,
      borderRadius: 2,
    },
    brandBlock: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    sevenWrap: {
      paddingHorizontal: 16,
    },
    brandSeven: {
      fontFamily: theme.fonts.monoExtraBold,
      fontSize: 38,
      letterSpacing: 4.5,
      color: '#FFFFFF',
      textAlign: 'center',
    },
    journalWrap: {
      paddingHorizontal: 16,
      marginTop: -4,
    },
    brandJournal: {
      fontFamily: theme.fonts.monoExtraBold,
      fontSize: 26,
      letterSpacing: 4,
      color: '#818CF8',
      textAlign: 'center',
    },
    taglineBox: {
      marginTop: 14,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    taglineText: {
      fontFamily: theme.fonts.monoBold,
      fontSize: 9.5,
      letterSpacing: 2,
      color: 'rgba(255, 255, 255, 0.55)',
    },
    cursor: {
      color: theme.colors.primaryLight,
      fontWeight: 'bold',
    },
    statusRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 22,
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(99, 102, 241, 0.12)',
      borderColor: 'rgba(99, 102, 241, 0.3)',
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primaryLight,
    },
    statusText: {
      fontFamily: theme.fonts.monoBold,
      fontSize: 8.5,
      letterSpacing: 1,
      color: theme.colors.primaryLight,
    },
    tickerFooter: {
      position: 'absolute',
      bottom: 28,
      left: 0,
      right: 0,
      height: 26,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    tickerScroll: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    tickerItem: {
      fontFamily: theme.fonts.monoBold,
      fontSize: 9,
      letterSpacing: 1,
      color: '#9CA3AF',
    },
    tickerSeparator: {
      color: 'rgba(255, 255, 255, 0.2)',
      marginHorizontal: 12,
      fontSize: 10,
    },
    greenText: {
      color: '#10B981',
    },
    redText: {
      color: '#EF4444',
    },
    goldText: {
      color: '#F59E0B',
    },
  });
