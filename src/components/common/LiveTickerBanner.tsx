import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTrades } from '../../features/trades/useTrades';
import { theme } from '../../theme';

export const LiveTickerBanner: React.FC = () => {
  const { trades } = useTrades();
  const animatedX = useRef(new Animated.Value(0)).current;

  const tickerItems = trades.length > 0
    ? trades.slice(0, 10).map(t => {
        const pnlVal = t.pnl ?? 0;
        const isPos = pnlVal >= 0;
        const rStr = t.r_multiple !== null ? `${t.r_multiple >= 0 ? '+' : ''}${t.r_multiple.toFixed(1)}R` : '';
        const pnlStr = t.pnl !== null ? `${isPos ? '+' : ''}$${t.pnl.toFixed(2)}` : 'OPEN';
        return {
          id: t.id,
          symbol: t.pair,
          direction: t.direction,
          pnl: pnlStr,
          r: rStr,
          up: isPos,
        };
      })
    : [
        { id: '1', symbol: 'XAUUSD', direction: 'BUY', pnl: '+$250.00', r: '+2.5R', up: true },
        { id: '2', symbol: 'EURUSD', direction: 'SELL', pnl: '-$100.00', r: '-1.0R', up: false },
        { id: '3', symbol: 'US30', direction: 'BUY', pnl: '+$450.00', r: '+3.0R', up: true },
      ];

  const items = [...tickerItems, ...tickerItems, ...tickerItems];

  useEffect(() => {
    animatedX.setValue(0);
    const animation = Animated.loop(
      Animated.timing(animatedX, {
        toValue: -350,
        duration: 12000,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [trades]);

  return (
    <View style={styles.container}>
      <View style={styles.badgeWrap}>
        <View style={styles.pulseDot} />
        <Text style={styles.liveText}>LIVE TRADES</Text>
      </View>

      <View style={styles.scrollArea}>
        <Animated.View
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

const styles = StyleSheet.create({
  container: {
    height: 32,
    backgroundColor: '#050609',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
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
    backgroundColor: '#10b981',
  },
  liveText: {
    color: '#818cf8',
    fontSize: 9,
    fontWeight: '900',
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
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '800',
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
    fontSize: 8,
    fontWeight: '900',
  },
  pnlText: {
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  rText: {
    fontSize: 9,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  greenText: { color: '#10b981' },
  redText: { color: '#ef4444' },
  blueText: { color: '#818cf8' },
  goldText: { color: '#f59e0b' },
});
