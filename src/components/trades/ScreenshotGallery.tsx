import React, { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, Image, FlatList, Dimensions } from 'react-native';
import { X, Images } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { withAlpha } from '../../theme';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { duration } from '../../theme/motion';
import { PressableScale } from '../ui/PressableScale';
import { useT } from '../../i18n';
import { localeFor } from '../../i18n';
import type { Trade } from '../../types/domain';

interface ScreenshotGalleryProps {
  visible: boolean;
  onClose: () => void;
  /** The journal (already scoped by the caller), most recent first. */
  trades: Trade[];
}

interface GalleryItem {
  trade: Trade;
  uri: string;
  phase: 'before' | 'after';
  key: string;
}

const COLS = 2;

/**
 * Pattern-training gallery.
 *
 * The screenshot fields existed, the fullscreen viewer existed — but there
 * was no way to review twenty setups in a row, which is how chart-recognition
 * is actually trained. Every attached image in one grid: tap, swipe through
 * the full-size charts, read the setup + R attached to each.
 */
export const ScreenshotGallery: React.FC<ScreenshotGalleryProps> = ({ visible, onClose, trades }) => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [index, setIndex] = useState<number | null>(null);
  const { width } = Dimensions.get('window');
  const tile = (width - 16 * 2 - 8 * (COLS - 1)) / COLS;

  const items = useMemo<GalleryItem[]>(() => {
    const out: GalleryItem[] = [];
    for (const trade of trades) {
      if (trade.screenshot_before_url) {
        out.push({ trade, uri: trade.screenshot_before_url, phase: 'before', key: `${trade.id}-b` });
      }
      if (trade.screenshot_after_url) {
        out.push({ trade, uri: trade.screenshot_after_url, phase: 'after', key: `${trade.id}-a` });
      }
    }
    return out;
  }, [trades]);

  const dateOf = (t: Trade) =>
    new Date(t.entry_time).toLocaleDateString(localeFor(lang), { day: '2-digit', month: 'short' });

  const rLabel = (t: Trade) =>
    t.r_multiple !== null ? `${t.r_multiple > 0 ? '+' : ''}${t.r_multiple.toFixed(1)}R` : '—';

  const closeViewer = () => setIndex(null);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(duration.fast)} style={styles.header}>
          <View style={styles.headerTitle}>
            <Images size={16} color={theme.colors.primary} strokeWidth={1.75} />
            <Text style={styles.headerText}>
              {t('galleryTitle', { count: items.length })}
            </Text>
          </View>
          <PressableScale onPress={onClose} accessibilityLabel={t('close')} hitSlop={12}>
            <X size={22} color={theme.colors.textPrimary} />
          </PressableScale>
        </Animated.View>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('galleryEmpty')}</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={i => i.key}
            numColumns={COLS}
            columnWrapperStyle={styles.column}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <PressableScale
                style={[styles.tile, { width: tile, height: tile * 0.75 }]}
                onPress={() => setIndex(items.indexOf(item))}
                accessibilityLabel={`${item.trade.pair} ${rLabel(item.trade)}`}
              >
                <Image source={{ uri: item.uri }} style={styles.image} resizeMode="cover" />
                {/* Phase badge, top-left: a pair can carry a before AND an
                    after shot; without the tag the two tiles were
                    indistinguishable in the grid. */}
                <View
                  style={[
                    styles.phaseBadge,
                    item.phase === 'before' ? styles.phaseBefore : styles.phaseAfter,
                  ]}
                >
                  <Text style={styles.phaseBadgeText}>
                    {item.phase === 'before' ? t('galleryBefore') : t('galleryAfter')}
                  </Text>
                </View>
                {/* Trade date, top-right — the phase badge's opposite corner,
                    so each overlay answers exactly one question: what shot is
                    this, and when was it taken. */}
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{dateOf(item.trade).toUpperCase()}</Text>
                </View>
                <View style={styles.tileMeta}>
                  <Text style={styles.tilePair}>{item.trade.pair}</Text>
                  <Text
                    style={[
                      styles.tileR,
                      { color: (item.trade.r_multiple ?? 0) >= 0 ? theme.colors.green : theme.colors.red },
                    ]}
                  >
                    {rLabel(item.trade)}
                  </Text>
                </View>
              </PressableScale>
            )}
          />
        )}

        {/* Fullscreen swipe-through viewer, one chart per page. */}
        <Modal visible={index !== null} animationType="fade" onRequestClose={closeViewer}>
          <View style={styles.viewer}>
            <View style={styles.viewerHeader}>
              {index !== null && items[index] ? (
                <Text style={styles.viewerLabel} numberOfLines={1}>
                  {items[index].trade.pair} · {dateOf(items[index].trade)} ·{' '}
                  {items[index].phase === 'before' ? t('galleryBefore') : t('galleryAfter')}
                </Text>
              ) : null}
              <PressableScale onPress={closeViewer} accessibilityLabel={t('close')} hitSlop={12}>
                <X size={22} color={theme.colors.textPrimary} />
              </PressableScale>
            </View>
            <FlatList
              data={items}
              keyExtractor={i => i.key}
              horizontal
              pagingEnabled
              initialScrollIndex={index ?? 0}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item.uri }}
                  style={{ width, flex: 1 }}
                  resizeMode="contain"
                  accessibilityLabel={`${item.trade.pair} ${rLabel(item.trade)}`}
                />
              )}
            />
            {index !== null ? (
              <Text style={styles.viewerCount}>
                {index + 1} / {items.length}
              </Text>
            ) : null}
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: 56,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.hairline,
    },
    headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerText: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    grid: { padding: 16, gap: 8 },
    column: { gap: 8 },
    tile: {
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    image: { width: '100%', height: '100%' },
    phaseBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    phaseBefore: {
      backgroundColor: withAlpha(theme.colors.card, 0.85),
      borderColor: withAlpha(theme.colors.primary, 0.7),
    },
    phaseAfter: {
      backgroundColor: withAlpha(theme.colors.card, 0.85),
      borderColor: withAlpha(theme.colors.green, 0.7),
    },
    phaseBadgeText: {
      color: theme.colors.textPrimary,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },
    dateBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: withAlpha(theme.colors.card, 0.85),
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.textMuted, 0.35),
    },
    dateBadgeText: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },
    tileMeta: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: withAlpha(theme.colors.background, 0.75),
    },
    tilePair: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },
    tileR: {
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.mono,
      textAlign: 'center',
    },
    viewer: { flex: 1, backgroundColor: '#000000' },
    viewerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: 56,
      paddingBottom: theme.spacing.sm,
    },
    viewerLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      flex: 1,
      marginRight: theme.spacing.md,
    },
    viewerCount: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      textAlign: 'center',
      paddingVertical: theme.spacing.sm,
    },
  });
