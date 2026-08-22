import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  onAnimationFinish: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ onAnimationFinish }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // ─── Animated values ───
  const containerFade = useRef(new Animated.Value(1)).current;
  const scanLineY = useRef(new Animated.Value(-200)).current;
  const scanLineOpacity = useRef(new Animated.Value(0)).current;

  // Halo
  const haloScale = useRef(new Animated.Value(0.5)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const haloPulse = useRef(new Animated.Value(0.2)).current;

  // Text "SEVEN" - main + glitch layers
  const sevenMainOpacity = useRef(new Animated.Value(0)).current;
  const sevenMainY = useRef(new Animated.Value(-25)).current;
  const sevenGlitchCyan = useRef(new Animated.Value(0)).current; // glitch color flash
  const sevenGlitchOffset = useRef(new Animated.Value(0)).current;

  // Text "JOURNAL" - main + glitch layers
  const journalMainOpacity = useRef(new Animated.Value(0)).current;
  const journalMainY = useRef(new Animated.Value(25)).current;
  const journalGlitchGreen = useRef(new Animated.Value(0)).current; // flash color
  const journalGlitchOffset = useRef(new Animated.Value(0)).current;

  // Line decorations
  const lineWidthLeft = useRef(new Animated.Value(0)).current;
  const lineWidthRight = useRef(new Animated.Value(0)).current;

  // Tagline typewriter
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const [taglineChars, setTaglineChars] = useState(0);
  const TAGLINE = 'QUANTITATIVE TRADING JOURNAL';

  // Progress
  const progressWidth = useRef(new Animated.Value(0)).current;

  // Status
  const statusOpacity = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(0.4)).current;

  // Corner brackets
  const bracketOpacity = useRef(new Animated.Value(0)).current;
  const bracketScale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    // ─── Phase 1: Halo ring appears ───
    const phase1 = Animated.parallel([
      Animated.spring(haloScale, { toValue: 1, friction: 5, tension: 35, useNativeDriver: true }),
      Animated.timing(haloOpacity, { toValue: 0.35, duration: 500, useNativeDriver: true }),
    ]);

    // ─── Phase 2: Scan line sweeps ───
    const phase2 = Animated.sequence([
      Animated.timing(scanLineOpacity, { toValue: 0.7, duration: 80, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(scanLineY, { toValue: 900, duration: 700, useNativeDriver: true }),
        Animated.timing(scanLineOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    ]);

    // ─── Phase 3: "SEVEN" drops in + glitch flash cyan ───
    const phase3 = Animated.parallel([
      Animated.spring(sevenMainY, { toValue: 0, friction: 7, tension: 55, useNativeDriver: true }),
      Animated.timing(sevenMainOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      // Glitch sequence: flash cyan then back to white
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(sevenGlitchCyan, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(sevenGlitchOffset, { toValue: 4, duration: 40, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(sevenGlitchOffset, { toValue: -3, duration: 40, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(sevenGlitchCyan, { toValue: 0, duration: 60, useNativeDriver: true }),
          Animated.timing(sevenGlitchOffset, { toValue: 2, duration: 30, useNativeDriver: true }),
        ]),
        Animated.timing(sevenGlitchOffset, { toValue: 0, duration: 30, useNativeDriver: true }),
      ]),
    ]);

    // ─── Phase 4: Lines extend ───
    const phase4 = Animated.parallel([
      Animated.timing(lineWidthLeft, { toValue: 1, duration: 450, useNativeDriver: false }),
      Animated.timing(lineWidthRight, { toValue: 1, duration: 450, useNativeDriver: false }),
    ]);

    // ─── Phase 5: "JOURNAL" slides up + flash green ───
    const phase5 = Animated.parallel([
      Animated.spring(journalMainY, { toValue: 0, friction: 7, tension: 55, useNativeDriver: true }),
      Animated.timing(journalMainOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      // Glitch sequence: flash green then back to indigo
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(journalGlitchGreen, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(journalGlitchOffset, { toValue: -4, duration: 40, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(journalGlitchOffset, { toValue: 3, duration: 40, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(journalGlitchGreen, { toValue: 0, duration: 60, useNativeDriver: true }),
          Animated.timing(journalGlitchOffset, { toValue: -1, duration: 30, useNativeDriver: true }),
        ]),
        Animated.timing(journalGlitchOffset, { toValue: 0, duration: 30, useNativeDriver: true }),
      ]),
    ]);

    // ─── Phase 6: Corner brackets ───
    const phase6 = Animated.parallel([
      Animated.spring(bracketScale, { toValue: 1, friction: 8, tension: 50, useNativeDriver: true }),
      Animated.timing(bracketOpacity, { toValue: 0.5, duration: 300, useNativeDriver: true }),
    ]);

    // ─── Phase 7: Tagline typewriter ───
    const phase7 = Animated.timing(taglineOpacity, { toValue: 1, duration: 200, useNativeDriver: true });

    // ─── Phase 8: Progress bar fills ───
    const phase8 = Animated.timing(progressWidth, { toValue: 1, duration: 1100, useNativeDriver: false });

    // ─── Phase 9: Status fades in ───
    const phase9 = Animated.timing(statusOpacity, { toValue: 1, duration: 300, useNativeDriver: true });

    // ─── Phase 10: Exit ───
    const phase10 = Animated.parallel([
      Animated.timing(containerFade, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.spring(haloScale, { toValue: 1.4, friction: 6, useNativeDriver: true }),
    ]);

    // ─── Master timeline ───
    Animated.sequence([
      phase1,
      Animated.stagger(60, [phase2, phase3]),
      phase4,
      Animated.stagger(50, [phase5, phase6]),
      phase7,
      Animated.stagger(40, [phase8, phase9]),
      Animated.delay(900),
      phase10,
    ]).start(() => {
      onAnimationFinish();
    });

    // ─── Typewriter timer ───
    const typeTimer = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setTaglineChars(i);
        if (i >= TAGLINE.length) clearInterval(interval);
      }, 40);
      return () => clearInterval(interval);
    }, 1800);

    // ─── Ambient pulsing loops ───
    const dotLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 0.3, duration: 650, useNativeDriver: true }),
      ])
    );
    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(haloPulse, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(haloPulse, { toValue: 0.2, duration: 1000, useNativeDriver: true }),
      ])
    );
    dotLoop.start();
    haloLoop.start();

    return () => {
      dotLoop.stop();
      haloLoop.stop();
      clearTimeout(typeTimer);
    };
  }, []);

  // ─── Interpolations ───
  const progressFillWidth = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const leftLineWidth = lineWidthLeft.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '38%'],
  });
  const rightLineWidth = lineWidthRight.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '38%'],
  });


  return (
    <Animated.View style={[styles.container, { opacity: containerFade }]}>
      {/* Background ambient glow */}
      <View style={styles.ambientGlow} />

      {/* Scanning line */}
      <Animated.View
        style={[
          styles.scanLine,
          { transform: [{ translateY: scanLineY }], opacity: scanLineOpacity },
        ]}
      />

      {/* Halo ring */}
      <Animated.View
        style={[
          styles.halo,
          {
            opacity: Animated.add(haloOpacity, haloPulse),
            transform: [{ scale: haloScale }],
          },
        ]}
      />

      {/* Main content */}
      <View style={styles.mainContent}>
        {/* ── Brand text: SEVEN ── */}
        <Animated.View
          style={[
            styles.sevenWrap,
            {
              opacity: sevenMainOpacity,
              transform: [
                { translateY: sevenMainY },
                { translateX: sevenGlitchOffset },
              ],
            },
          ]}
        >
          {/* Cyan glitch ghost */}
          <Animated.Text
            style={[
              styles.brandSeven,
              styles.glitchGhost,
              {
                opacity: sevenGlitchCyan,
                color: theme.colors.cyan,
                transform: [{ translateX: sevenGlitchCyan }],
              },
            ]}
          >
            SEVEN
          </Animated.Text>
          {/* Main white text */}
          <Text style={[styles.brandSeven, { color: theme.colors.textPrimary }]}>
            SEVEN
          </Text>
        </Animated.View>

        {/* ── Brand text: JOURNAL ── */}
        <Animated.View
          style={[
            styles.journalWrap,
            {
              opacity: journalMainOpacity,
              transform: [
                { translateY: journalMainY },
                { translateX: journalGlitchOffset },
              ],
            },
          ]}
        >
          {/* Green flash ghost */}
          <Animated.Text
            style={[
              styles.brandJournal,
              styles.glitchGhost,
              {
                opacity: journalGlitchGreen,
                color: theme.colors.green,
                transform: [{ translateX: Animated.multiply(journalGlitchGreen, -1) }],
              },
            ]}
          >
            JOURNAL
          </Animated.Text>
          {/* Main indigo text */}
          <Text style={[styles.brandJournal, { color: theme.colors.primaryLight }]}>
            JOURNAL
          </Text>
        </Animated.View>

        {/* ── Tagline (typewriter) ── */}
        <Animated.View style={[styles.taglineRow, { opacity: taglineOpacity }]}>
          <Text style={styles.taglineText}>
            {TAGLINE.slice(0, taglineChars)}
            {taglineChars < TAGLINE.length && <Text style={styles.cursor}>▌</Text>}
          </Text>
        </Animated.View>

        {/* ── Decorative lines ── */}
        <View style={[styles.decorRow, { marginTop: 22 }]}>
          <Animated.View style={[styles.decorLine, { width: leftLineWidth }]} />
          <View style={styles.decorDot} />
          <Animated.View style={[styles.decorLine, { width: rightLineWidth }]} />
        </View>

        {/* ── Corner brackets ── */}
        <Animated.View
          style={[
            styles.bracketFrame,
            { opacity: bracketOpacity, transform: [{ scale: bracketScale }] },
          ]}
        >
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </Animated.View>

        {/* ── Progress bar ── */}
        <View style={styles.progressBg}>
          <Animated.View style={[styles.progressFill, { width: progressFillWidth }]} />
        </View>

        {/* ── Status ── */}
        <Animated.View style={[styles.statusRow, { opacity: statusOpacity }]}>
          <Animated.View style={[styles.liveDot, { opacity: dotPulse }]} />
          <Text style={styles.statusText}>INITIALISATION DU JOURNAL...</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ambientGlow: {
      position: 'absolute',
      width: 420,
      height: 420,
      borderRadius: 210,
      backgroundColor: 'rgba(99, 102, 241, 0.06)',
    },
    scanLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: theme.colors.primaryLight,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 14,
      elevation: 12,
    },
    halo: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      borderWidth: 1.5,
      borderColor: 'rgba(99, 102, 241, 0.3)',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7,
      shadowRadius: 44,
      elevation: 22,
    },
    mainContent: {
      alignItems: 'center',
      justifyContent: 'center',
      width: SCREEN_W,
      paddingHorizontal: 20,
    },

    // ── Brand text ──
    sevenWrap: {
      alignItems: 'center',
      marginBottom: 2,
      justifyContent: 'center',
      overflow: 'visible',
      paddingHorizontal: 16,
    },
    journalWrap: {
      alignItems: 'center',
      marginBottom: 10,
      justifyContent: 'center',
      overflow: 'visible',
      paddingHorizontal: 16,
    },
    glitchGhost: {
      position: 'absolute',
    },
    brandSeven: {
      fontSize: 34,
      fontFamily: theme.fonts.sansExtraBold,
      letterSpacing: 3.5,
      paddingRight: 6,
      textAlign: 'center',
    },
    brandJournal: {
      fontSize: 34,
      fontFamily: theme.fonts.sansExtraBold,
      letterSpacing: 3.5,
      paddingRight: 6,
      textAlign: 'center',
    },
    // ── Tagline ──
    taglineRow: {
      marginBottom: 26,
      minHeight: 16,
    },
    taglineText: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 2.5,
    },
    cursor: {
      color: theme.colors.primaryLight,
    },
    // ── Decorations ──
    decorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      marginBottom: 20,
    },
    decorLine: {
      height: 1,
      backgroundColor: theme.colors.cardBorder,
    },
    decorDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: theme.colors.primaryLight,
      marginHorizontal: 10,
    },
    // ── Brackets ──
    bracketFrame: {
      position: 'absolute',
      width: SCREEN_W * 0.74,
      height: 310,
    },
    corner: {
      position: 'absolute',
      width: 14,
      height: 14,
      borderColor: 'rgba(129, 140, 248, 0.35)',
    },
    cornerTL: { top: 0, left: 0, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
    cornerTR: { top: 0, right: 0, borderTopWidth: 1.5, borderRightWidth: 1.5 },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
    // ── Progress ──
    progressBg: {
      width: 200,
      height: 2,
      backgroundColor: theme.colors.cardBorder,
      borderRadius: 1,
      overflow: 'hidden',
      marginBottom: 16,
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primaryLight,
      borderRadius: 1,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 8,
      elevation: 5,
    },
    // ── Status ──
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.green,
    },
    statusText: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.monoMedium,
      letterSpacing: 1.2,
    },
  });
