import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Globe, Play, Square, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { PressableScale } from '../ui/PressableScale';

function getMarketSessions(date: Date) {
  const utcHour = date.getUTCHours();
  return [
    { name: 'Tokyo', open: utcHour >= 0 && utcHour < 9 },
    { name: 'Londres', open: utcHour >= 7 && utcHour < 16 },
    { name: 'New York', open: utcHour >= 12 && utcHour < 21 },
    { name: 'Sydney', open: utcHour >= 21 || utcHour < 6 },
  ];
}

/**
 * Market sessions pills + session timer, isolated in its own component so the
 * 1-second clock tick re-renders ONLY this small bar — not the whole
 * Dashboard (charts included), which previously re-rendered 60×/min.
 */
export const MarketSessionsBar: React.FC = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [now, setNow] = useState(new Date());
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      if (sessionActive && sessionStart) {
        setSessionElapsed(Math.floor((Date.now() - sessionStart.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionActive, sessionStart]);

  const toggleSession = () => {
    if (sessionActive) {
      setSessionActive(false);
      setSessionStart(null);
      setSessionElapsed(0);
    } else {
      setSessionActive(true);
      setSessionStart(new Date());
    }
  };

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const min = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const sessionOverLimit = sessionElapsed >= 4 * 3600;
  const marketSessions = useMemo(() => getMarketSessions(now), [now]);

  return (
    <View style={styles.sessionsRow}>
      <View style={styles.sessionsWrapper}>
        <Globe color={theme.colors.textMuted} size={14} style={{ marginRight: 4 }} />
        {marketSessions.map(s => (
          <View
            key={s.name}
            style={[styles.sessionPill, s.open ? styles.sessionOpen : styles.sessionClosed]}
          >
            {s.open && <View style={styles.openDot} />}
            <Text
              style={[styles.sessionText, s.open ? styles.sessionTextOpen : styles.sessionTextClosed]}
            >
              {s.name}
            </Text>
          </View>
        ))}
      </View>

      <PressableScale
        style={[
          styles.sessionTimerBtn,
          sessionActive ? (sessionOverLimit ? styles.timerRed : styles.timerGreen) : styles.timerNeutral,
        ]}
        onPress={toggleSession}
        accessibilityLabel={sessionActive ? 'Stop session timer' : 'Start session timer'}
      >
        {sessionActive ? (
          <Square color={theme.colors.textPrimary} size={12} />
        ) : (
          <Play color={theme.colors.textPrimary} size={12} />
        )}
        <Text style={styles.sessionTimerText}>
          {sessionActive ? formatElapsed(sessionElapsed) : 'Session'}
        </Text>
        {sessionOverLimit && (
          <View style={styles.alertMiniRow}>
            <AlertTriangle size={10} color={theme.colors.gold} />
            <Text style={styles.alertMini}>4H+</Text>
          </View>
        )}
      </PressableScale>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    sessionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    sessionsWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      flexWrap: 'wrap',
      flex: 1,
    },
    sessionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
    },
    sessionOpen: {
      backgroundColor: theme.colors.greenGlow,
      borderColor: 'rgba(16, 185, 129, 0.4)',
    },
    sessionClosed: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.cardBorder,
    },
    openDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.colors.green,
    },
    sessionText: {
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.3,
    },
    sessionTextOpen: { color: theme.colors.greenLight },
    sessionTextClosed: { color: theme.colors.textDark },
    sessionTimerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
    },
    timerNeutral: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.cardBorder,
    },
    timerGreen: {
      backgroundColor: theme.colors.greenGlow,
      borderColor: 'rgba(16, 185, 129, 0.4)',
    },
    timerRed: {
      backgroundColor: theme.colors.redGlow,
      borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    sessionTimerText: {
      color: theme.colors.textPrimary,
      fontSize: 10,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    alertMiniRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    alertMini: {
      color: theme.colors.gold,
      fontSize: 8,
      fontFamily: theme.fonts.monoBold,
    },
  });
