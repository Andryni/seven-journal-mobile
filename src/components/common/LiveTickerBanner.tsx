import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, LayoutChangeEvent } from 'react-native';
import { useTrades } from '../../features/trades/useTrades';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { formatCurrency } from '../../utils/formatCurrency';

export const LiveTickerBanner: React.FC = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { trades } = useTrades();
  const animatedX = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  const tickerItems = trades.slice(0, 10).map(t => {
    const pnlVal = t.pnl ?? 0;
    const isPos = pnlVal >= 0;
    const rStr = t.r_multiple !== null ? `${t.r_multiple >= 0 ? '+' : ''}${t.r_multiple.toFixed(1)}R` : '';
    const pnlStr = t.pnl !== null ? formatCurrency(t.pnl) : 'OPEN';
    return {
      id: t.id,
      symbol: t.pair,
      direction: t.direction,
      pnl: pnlStr,
      r: rStr,
      up: isPos,
    };
  });

  const items = [...tickerItems, ...tickerItems];

  // Marquee loop: scroll exactly one measured set width for a seamless wrap
  useEffect(() => {
    if (tickerItems.length === 0 || trackWidth === 0) return;
    const singleSetWidth = trackWidth / 2;
    animatedX.setValue(0);
    const animation = Animated.loop(
      Animated.timing(animatedX, {
        toValue: -singleSetWidth,
        duration: Math.max(8000, singleSetWidth * 30),
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [trades, trackWidth, tickerItems.length, animatedX]);

  // LIVE dot heartbeat pulse
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - trackWidth) > 1) setTrackWidth(w);
  };

  // IMPORTANT: conditional return AFTER all hooks (Rules of Hooks)
  if (tickerItems.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.badgeWrap}>
        <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
        <Text style={styles.liveText}>LIVE TRADES</Text>
      </View>

      <View style={styles.scrollArea}>
        <Animated.View
          onLayout={onTrackLayout}
          style={[
            styles.tickerTrack,
            {
              transform: [{ translateX: animatedX }],
            },
          ]}
        >
          {items.map((item, idx) => (
            <View key={`${item.id}-${idx}`} style={styles.tickerItem}>
              <Text style={styles.symbolText}>{item.symbol}</Text>
              <View
                style={[
                  styles.dirBadge,
                  item.direction === 'BUY' ? styles.dirBuy : styles.dirSell,
                ]}
              >
                <Text
                  style={[
                    styles.dirText,
                    item.direction === 'BUY' ? styles.greenText : styles.blueText,
                  ]}
                >
                  {item.direction}
                </Text>
              </View>
              <Text style={[styles.pnlText, item.up ? styles.greenText : styles.redText]}>
                {item.pnl}
              </Text>
              {item.r ? (
                <Text style={[styles.rText, item.up ? styles.goldText : styles.redText]}>
                  ({item.r})
                </Text>
              ) : null}
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    height: 32,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 8,
    height: '100%',
    zIndex: 10,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.green,
  },
  liveText: {
    color: theme.colors.primaryLight,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.6,
  },
  scrollArea: {
    flex: 1,
    overflow: 'hidden',
  },
  tickerTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  tickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  symbolText: {
    color: theme.colors.textPrimary,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
  },
  dirBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  dirBuy: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  dirSell: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  dirText: {
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
  },
  pnlText: {
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  rText: {
    fontSize: 9,
    fontFamily: theme.fonts.monoMedium,
    fontVariant: ['tabular-nums'],
  },
  greenText: { color: theme.colors.green },
  redText: { color: theme.colors.red },
  blueText: { color: theme.colors.primaryLight },
  goldText: { color: theme.colors.gold },
});
