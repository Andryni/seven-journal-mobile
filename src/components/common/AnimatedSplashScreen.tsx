import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image } from 'react-native';
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

  // Official Logo Reveal
  const logoScale = useRef(new Animated.Value(0.75)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoGlow = useRef(new Animated.Value(0.3)).current;

  // Candlesticks Animation (5 live candlesticks forming a bullish breakout)
  const candle1Scale = useRef(new Animated.Value(0)).current;
  const candle2Scale = useRef(new Animated.Value(0)).current;
  const candle3Scale = useRef(new Animated.Value(0)).current;
  const candle4Scale = useRef(new Animated.Value(0)).current;
  const candle5Scale = useRef(new Animated.Value(0)).current;
  const candlesOpacity = useRef(new Animated.Value(0)).current;

  // Live Chart Trendline Curve
  const chartPathProgress = useRef(new Animated.Value(0)).current;
  const chartGlow = useRef(new Animated.Value(0)).current;

  // Scanner Laser Line
  const scannerY = useRef(new Animated.Value(-100)).current;
  const scannerOpacity = useRef(new Animated.Value(0)).current;

  // Pulse point at the tip of the breakout
  const tipPulse = useRef(new Animated.Value(0.5)).current;

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

  // Loading Progress Bar
  const progressWidth = useRef(new Animated.Value(0)).current;

  // Status Badges
  const statusOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ── Phase 1: Background Market Grid & Ambient Glow ──
    const p1Grid = Animated.timing(gridOpacity, {
      toValue: 0.5,
      duration: 350,
      useNativeDriver: true,
    });

    // ── Phase 2: Laser Scanner Sweeps Down ──
    const p2Scanner = Animated.sequence([
      Animated.timing(scannerOpacity, { toValue: 0.8, duration: 100, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(scannerY, { toValue: SCREEN_H * 0.7, duration: 600, useNativeDriver: true }),
        Animated.timing(scannerOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]);

    // ── Phase 3: Logo Reveal with Glow ──
    const p3Logo = Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.timing(logoGlow, { toValue: 0.9, duration: 450, useNativeDriver: true }),
    ]);

    // ── Phase 4: Dynamic Candlestick Formations (Sweep -> Consolidation -> Breakout) ──
    const p4Candles = Animated.parallel([
      Animated.timing(candlesOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.stagger(80, [
        Animated.spring(candle1Scale, { toValue: 1, friction: 6, tension: 45, useNativeDriver: true }),
        Animated.spring(candle2Scale, { toValue: 1, friction: 6, tension: 45, useNativeDriver: true }),
        Animated.spring(candle3Scale, { toValue: 1, friction: 6, tension: 45, useNativeDriver: true }),
        Animated.spring(candle4Scale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
        Animated.spring(candle5Scale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
      ]),
      Animated.timing(chartPathProgress, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(chartGlow, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]);

    // ── Phase 5: Brand Reveal ("SEVEN" + "JOURNAL") ──
    const p5Brand = Animated.parallel([
      Animated.spring(sevenScale, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
      Animated.timing(sevenOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(journalY, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
      Animated.timing(journalOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]);

    // ── Phase 6: Status Badges & Tagline (native driver) ──
    const p6Badges = Animated.parallel([
      Animated.timing(taglineOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(statusOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(tickerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]);

    // ── Phase 7: Exit Transition ──
    const p7Exit = Animated.parallel([
      Animated.timing(containerFade, { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.timing(logoScale, { toValue: 1.06, duration: 350, useNativeDriver: true }),
    ]);

    // Run master sequence
    Animated.sequence([
      p1Grid,
      p2Scanner,
      p3Logo,
      p4Candles,
      p5Brand,
      p6Badges,
      Animated.delay(900),
      p7Exit,
    ]).start(() => {
      onAnimationFinish();
    });

    // Progress bar runs independently (useNativeDriver: false — cannot mix in native sequence)
    const progressTimer = setTimeout(() => {
      Animated.timing(progressWidth, { toValue: 1, duration: 800, useNativeDriver: false }).start();
    }, 1800); // Approximate delay to sync with Phase 6

    // Typewriter timer for subtitle with proper interval clearing
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const typeTimer = setTimeout(() => {
      let idx = 0;
      intervalId = setInterval(() => {
        idx++;
        setTaglineIndex(idx);
        if (idx >= TAGLINE.length && intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }, 30);
    }, 1100);

    // Fallback safety timer to ensure splash finish is ALWAYS called even if native animation stutters
    const safetyTimer = setTimeout(() => {
      onAnimationFinish();
    }, 4500);

    // Continuous pulsing loop on breakout tip
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(tipPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(tipPulse, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ])
    );
    pulseAnim.start();

    // Continuous ticker horizontal scrolling
    const tickerAnim = Animated.loop(
      Animated.timing(tickerTranslateX, {
        toValue: -180,
        duration: 3500,
        useNativeDriver: true,
      })
    );
    tickerAnim.start();

    return () => {
      pulseAnim.stop();
      tickerAnim.stop();
      clearTimeout(typeTimer);
      clearTimeout(safetyTimer);
      clearTimeout(progressTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const progressInterpolated = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: containerFade }]}>
      {/* Background ambient radial glow */}
      <View style={styles.ambientGlow} />

      {/* Grid Pattern (Trading Desk Background) */}
      <Animated.View style={[styles.gridWrap, { opacity: gridOpacity }]} pointerEvents="none">
        <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="gridGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#6366F1" stopOpacity="0.15" />
              <Stop offset="50%" stopColor="#10B981" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#000" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {/* Horizontal grid lines */}
          {[0.18, 0.32, 0.46, 0.6, 0.74, 0.88].map((ratio, i) => (
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
          {[0.15, 0.32, 0.5, 0.68, 0.85].map((ratio, i) => (
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

      {/* Scanner Laser Beam */}
      <Animated.View
        style={[
          styles.scannerBeam,
          {
            transform: [{ translateY: scannerY }],
            opacity: scannerOpacity,
          },
        ]}
      />

      {/* Main Visual Stage */}
      <View style={styles.centerStage}>
        {/* Top: Official Logo Emblem with Glow */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Animated.View style={[styles.logoAura, { opacity: logoGlow }]} />
          <Image
            source={require('../../assets/seven_tracking_logo.png')}
            style={styles.officialLogoImg}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Middle: Live Candlestick Breakout Chart Animation */}
        <Animated.View style={[styles.chartStage, { opacity: candlesOpacity }]}>
          {/* Candle 1 (Red Sweep) */}
          <Animated.View style={[styles.candleCol, { transform: [{ scaleY: candle1Scale }] }]}>
            <View style={[styles.wick, { height: 28, backgroundColor: 'rgba(239, 68, 68, 0.6)' }]} />
            <View style={[styles.body, { height: 16, backgroundColor: '#EF4444' }]} />
          </Animated.View>

          {/* Candle 2 (Doji Rejection) */}
          <Animated.View style={[styles.candleCol, { transform: [{ scaleY: candle2Scale }] }]}>
            <View style={[styles.wick, { height: 36, backgroundColor: 'rgba(245, 158, 11, 0.6)' }]} />
            <View style={[styles.body, { height: 6, backgroundColor: '#F59E0B' }]} />
          </Animated.View>

          {/* Candle 3 (Green Shift) */}
          <Animated.View style={[styles.candleCol, { transform: [{ scaleY: candle3Scale }] }]}>
            <View style={[styles.wick, { height: 32, backgroundColor: 'rgba(16, 185, 129, 0.6)' }]} />
            <View style={[styles.body, { height: 20, backgroundColor: '#10B981' }]} />
          </Animated.View>

          {/* Candle 4 (Green Acceleration) */}
          <Animated.View style={[styles.candleCol, { transform: [{ scaleY: candle4Scale }] }]}>
            <View style={[styles.wick, { height: 44, backgroundColor: 'rgba(16, 185, 129, 0.7)' }]} />
            <View style={[styles.body, { height: 28, backgroundColor: '#10B981' }]} />
          </Animated.View>

          {/* Candle 5 (Strong Bullish Expansion + Breakout Point) */}
          <Animated.View style={[styles.candleCol, { transform: [{ scaleY: candle5Scale }] }]}>
            <View style={[styles.wick, { height: 58, backgroundColor: 'rgba(52, 211, 153, 0.8)' }]} />
            <View style={[styles.body, { height: 40, backgroundColor: '#34D399' }]} />
            {/* Glowing Breakout Target Dot */}
            <Animated.View style={[styles.breakoutDot, { opacity: tipPulse }]} />
          </Animated.View>
        </Animated.View>

        {/* Brand Typography : SEVEN JOURNAL */}
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

        {/* Typewriter Subtitle */}
        <Animated.View style={[styles.taglineBox, { opacity: taglineOpacity }]}>
          <Text style={styles.taglineText}>
            {TAGLINE.slice(0, taglineIndex)}
            {taglineIndex < TAGLINE.length && <Text style={styles.cursor}>▌</Text>}
          </Text>
        </Animated.View>

        {/* Terminal Loading Progress Bar */}
        <View style={styles.progressBarWrapper}>
          <Animated.View style={[styles.progressBarFill, { width: progressInterpolated }]} />
        </View>

        {/* Terminal Status Badges */}
        <Animated.View style={[styles.statusRow, { opacity: statusOpacity }]}>
          <View style={styles.statusChip}>
            <Animated.View style={[styles.statusDot, { opacity: tipPulse }]} />
            <Text style={styles.statusText}>PRICE ACTION ENGINE</Text>
          </View>
          <View style={[styles.statusChip, { borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
            <Text style={[styles.statusText, { color: '#34D399' }]}>DISCIPLINE MATRIX 2.0</Text>
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
    scannerBeam: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: '#10B981',
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 8,
    },
    centerStage: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    logoContainer: {
      width: 76,
      height: 76,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    logoAura: {
      position: 'absolute',
      width: 86,
      height: 86,
      borderRadius: 43,
      backgroundColor: 'rgba(99, 102, 241, 0.3)',
    },
    officialLogoImg: {
      width: 70,
      height: 70,
    },
    chartStage: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 12,
      height: 64,
      marginBottom: 14,
    },
    candleCol: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 12,
    },
    wick: {
      position: 'absolute',
      width: 2,
      borderRadius: 1,
    },
    body: {
      width: 10,
      borderRadius: 2,
    },
    breakoutDot: {
      position: 'absolute',
      top: -6,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#34D399',
      shadowColor: '#34D399',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 4,
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
      fontSize: 34,
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
      fontSize: 24,
      letterSpacing: 4,
      color: '#818CF8',
      textAlign: 'center',
    },
    taglineBox: {
      marginTop: 10,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    taglineText: {
      fontFamily: theme.fonts.monoBold,
      fontSize: 9,
      letterSpacing: 2,
      color: 'rgba(255, 255, 255, 0.55)',
    },
    cursor: {
      color: theme.colors.primaryLight,
      fontWeight: 'bold',
    },
    progressBarWrapper: {
      width: 160,
      height: 3,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 2,
      overflow: 'hidden',
      marginTop: 14,
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: '#10B981',
      borderRadius: 2,
    },
    statusRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 16,
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(99, 102, 241, 0.12)',
      borderColor: 'rgba(99, 102, 241, 0.3)',
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primaryLight,
    },
    statusText: {
      fontFamily: theme.fonts.monoBold,
      fontSize: 8,
      letterSpacing: 1,
      color: theme.colors.primaryLight,
    },
    tickerFooter: {
      position: 'absolute',
      bottom: 24,
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
