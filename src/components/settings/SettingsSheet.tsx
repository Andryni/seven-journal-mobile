import React, { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { X, Bell, Fingerprint, Languages, Clock, Calculator, Pin } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { withAlpha } from '../../theme';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT, useI18nStore } from '../../i18n';
import { Hairline } from '../ui/Panel';
import { PressableScale } from '../ui/PressableScale';
import { duration } from '../../theme/motion';
import { useNotifications } from '../../features/notifications/useNotifications';
import { useAppLock } from '../../features/security/useAppLock';
import { usePinnedMonth } from '../../features/dashboard/usePinnedMonth';
import { usePinnedWeek } from '../../features/dashboard/usePinnedWeek';
import { PositionCalculator } from '../trades/PositionCalculator';

/**
 * Settings — surfaces the capabilities that previously had no entry point
 * (notifications, biometric lock) plus language. Kept as a sheet rather than a
 * seventh tab: the tab bar is already at its five-item budget.
 */
export const SettingsSheet: React.FC<{ visible: boolean; onClose: () => void }> = ({
  visible,
  onClose,
}) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { lang, toggleLang } = useI18nStore();
  const notifications = useNotifications();
  const appLock = useAppLock();
  const { pinned, toggle } = usePinnedMonth();
  const { pinned: pinnedWeek, toggle: toggleWeek } = usePinnedWeek();
  const [busy, setBusy] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  const onToggleNotifications = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) {
        const granted = await notifications.enable();
        if (!granted) Alert.alert(t('notifications'), t('notificationsDenied'));
      } else {
        await notifications.disable();
      }
    } finally {
      setBusy(false);
    }
  };

  const onToggleAppLock = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) {
        const ok = await appLock.enable();
        if (!ok) Alert.alert(t('appLock'), t('appLockUnavailable'));
      } else {
        appLock.disable();
      }
    } finally {
      setBusy(false);
    }
  };

  const trackColor = { false: theme.colors.surfaceLight, true: theme.colors.primaryMuted };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View entering={FadeIn.duration(duration.fast)} style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('settings')}</Text>
            <PressableScale onPress={onClose} hitSlop={12} accessibilityLabel={t('cancel')}>
              <X size={18} color={theme.colors.textSecondary} />
            </PressableScale>
          </View>
          <Hairline />

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* Notifications */}
            <Row
              icon={<Bell size={15} color={theme.colors.primary} strokeWidth={1.75} />}
              title={t('notifications')}
              sub={
                // Say why the switch is inert instead of letting the user
                // toggle something that silently cannot work.
                notifications.available ? t('notificationsDesc') : t('notificationsExpoGo')
              }
              theme={theme}
              right={
                <Switch
                  value={notifications.prefs.enabled && notifications.available}
                  onValueChange={onToggleNotifications}
                  disabled={busy || !notifications.available}
                  trackColor={trackColor}
                  thumbColor={
                    notifications.prefs.enabled ? theme.colors.primary : theme.colors.textMuted
                  }
                />
              }
            />

            {notifications.prefs.enabled && notifications.available ? (
              <>
                <Hairline inset={38} />
                <Row
                  icon={<Clock size={15} color={theme.colors.textMuted} strokeWidth={1.75} />}
                  title={t('journalReminder')}
                  sub={`${String(notifications.prefs.journalHour).padStart(2, '0')}:00`}
                  theme={theme}
                  right={
                    <Switch
                      value={notifications.prefs.journalReminder}
                      onValueChange={v => notifications.prefs.set({ journalReminder: v })}
                      trackColor={trackColor}
                      thumbColor={
                        notifications.prefs.journalReminder
                          ? theme.colors.primary
                          : theme.colors.textMuted
                      }
                    />
                  }
                />
                {notifications.prefs.journalReminder ? (
                  <ChipRow
                    theme={theme}
                    options={JOURNAL_HOURS.map(h => ({
                      value: h,
                      label: `${String(h).padStart(2, '0')}h`,
                    }))}
                    selected={notifications.prefs.journalHour}
                    onSelect={v => notifications.prefs.set({ journalHour: v })}
                    accessibilityLabel={t('journalReminder')}
                  />
                ) : null}
                <Hairline inset={38} />
                <Row
                  icon={<Bell size={15} color={theme.colors.textMuted} strokeWidth={1.75} />}
                  title={t('riskAlerts')}
                  sub={t('riskAlertsDesc')}
                  theme={theme}
                  right={
                    <Switch
                      value={notifications.prefs.riskAlerts}
                      onValueChange={v => notifications.prefs.set({ riskAlerts: v })}
                      trackColor={trackColor}
                      thumbColor={
                        notifications.prefs.riskAlerts
                          ? theme.colors.primary
                          : theme.colors.textMuted
                      }
                    />
                  }
                />
                {notifications.prefs.riskAlerts ? (
                  <ChipRow
                    theme={theme}
                    options={RISK_THRESHOLDS.map(v => ({ value: v, label: `${v}%` }))}
                    selected={notifications.prefs.riskThresholdPct}
                    onSelect={v => notifications.prefs.set({ riskThresholdPct: v })}
                    accessibilityLabel={t('riskAlerts')}
                  />
                ) : null}
                <Hairline inset={38} />
                <Row
                  icon={<Clock size={15} color={theme.colors.textMuted} strokeWidth={1.75} />}
                  title={t('weeklyReview')}
                  sub={t('weeklyReviewNotifDesc')}
                  theme={theme}
                  right={
                    <Switch
                      value={notifications.prefs.weeklyReview}
                      onValueChange={v => notifications.prefs.set({ weeklyReview: v })}
                      trackColor={trackColor}
                      thumbColor={
                        notifications.prefs.weeklyReview
                          ? theme.colors.primary
                          : theme.colors.textMuted
                      }
                    />
                  }
                />
                {notifications.prefs.weeklyReview ? (
                  <>
                    <ChipRow
                      theme={theme}
                      options={WEEKDAYS.map((labelKey, i) => ({
                        value: i + 1,
                        label: t(labelKey as never),
                      }))}
                      selected={notifications.prefs.weeklyDay}
                      onSelect={v => notifications.prefs.set({ weeklyDay: v })}
                      accessibilityLabel={t('weeklyReview')}
                    />
                    <ChipRow
                      theme={theme}
                      options={WEEKLY_HOURS.map(h => ({
                        value: h,
                        label: `${String(h).padStart(2, '0')}h`,
                      }))}
                      selected={notifications.prefs.weeklyHour}
                      onSelect={v => notifications.prefs.set({ weeklyHour: v })}
                      accessibilityLabel={t('weeklyReview')}
                    />
                  </>
                ) : null}
              </>
            ) : null}

            <View style={styles.sectionGap} />

            {/* Security */}
            <Row
              icon={<Fingerprint size={15} color={theme.colors.primary} strokeWidth={1.75} />}
              title={t('appLock')}
              sub={t('appLockDesc')}
              theme={theme}
              right={
                <Switch
                  value={appLock.enabled}
                  onValueChange={onToggleAppLock}
                  disabled={busy}
                  trackColor={trackColor}
                  thumbColor={appLock.enabled ? theme.colors.primary : theme.colors.textMuted}
                />
              }
            />

            <View style={styles.sectionGap} />

            {/* Pinned month card — the dashboard's export shortcut. One shared
                store with the dashboard, whose × unhooks it here too. */}
            <Row
              icon={<Pin size={15} color={theme.colors.primary} strokeWidth={1.75} />}
              title={t('pinnedMonthSetting')}
              sub={t('pinnedMonthDesc')}
              theme={theme}
              right={
                <Switch
                  value={pinned}
                  onValueChange={toggle}
                  trackColor={trackColor}
                  thumbColor={pinned ? theme.colors.primary : theme.colors.textMuted}
                />
              }
            />
            <Row
              icon={<Pin size={15} color={theme.colors.primary} strokeWidth={1.75} />}
              title={t('pinnedWeekSetting')}
              sub={t('pinnedWeekDesc')}
              theme={theme}
              right={
                <Switch
                  value={pinnedWeek}
                  onValueChange={toggleWeek}
                  trackColor={trackColor}
                  thumbColor={pinnedWeek ? theme.colors.primary : theme.colors.textMuted}
                />
              }
            />

            <View style={styles.sectionGap} />

            {/* Position calculator — pre-trade tool. It used to live on the
                dashboard, which is a post-session recap; it belongs with the
                other utilities instead. */}
            <PressableScale
              onPress={() => setCalcOpen(v => !v)}
              accessibilityLabel={t('posCalcTitle')}
            >
              <Row
                icon={<Calculator size={15} color={theme.colors.primary} strokeWidth={1.75} />}
                title={t('posCalcTitle')}
                sub={t('posCalcSubtitle')}
                theme={theme}
              />
            </PressableScale>
            {calcOpen ? <PositionCalculator /> : null}

            <View style={styles.sectionGap} />

            {/* Language */}
            <PressableScale onPress={toggleLang} accessibilityLabel={t('switchLanguage')}>
              <Row
                icon={<Languages size={15} color={theme.colors.primary} strokeWidth={1.75} />}
                title={t('switchLanguage')}
                sub={lang === 'fr' ? 'Français' : 'English'}
                theme={theme}
                right={<Text style={styles.langBadge}>{lang.toUpperCase()}</Text>}
              />
            </PressableScale>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

/**
 * Offered times, rather than a free numeric input.
 *
 * A wheel picker for an hour is a native dependency and a modal for a value
 * with about six sensible answers. Journaling happens after the session
 * closes; the weekly review before the week opens.
 */
const JOURNAL_HOURS = [17, 18, 19, 20, 21, 22, 23];
const WEEKLY_HOURS = [8, 10, 12, 17, 18, 19, 20, 21];
const RISK_THRESHOLDS = [50, 60, 70, 80, 90];
/** Sunday-first, matching the WEEKLY trigger's weekday numbering (1 = Sun). */
const WEEKDAYS = [
  'daySunShort',
  'dayMonShort',
  'dayTueShort',
  'dayWedShort',
  'dayThuShort',
  'dayFriShort',
  'daySatShort',
];

/** Horizontal single-choice chips, indented to sit under a settings row. */
const ChipRow: React.FC<{
  theme: AppTheme;
  options: { value: number; label: string }[];
  selected: number;
  onSelect: (value: number) => void;
  accessibilityLabel: string;
}> = ({ theme, options, selected, onSelect, accessibilityLabel }) => {
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {options.map(opt => {
        const active = opt.value === selected;
        return (
          <PressableScale
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityLabel={`${accessibilityLabel} ${opt.label}`}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
};

const Row: React.FC<{
  icon: React.ReactNode;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  theme: AppTheme;
}> = ({ icon, title, sub, right, theme }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    }}
  >
    <View style={{ width: 22, alignItems: 'center' }}>{icon}</View>
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: theme.colors.textPrimary,
          fontSize: theme.type.body,
          fontFamily: theme.fonts.sansSemiBold,
        }}
      >
        {title}
      </Text>
      {sub ? (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.type.micro,
            fontFamily: theme.fonts.sans,
            marginTop: 2,
          }}
        >
          {sub}
        </Text>
      ) : null}
    </View>
    {right}
  </View>
);

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    chipRow: {
      // Aligned with the row text above, which clears the icon gutter.
      paddingLeft: 38,
      paddingRight: 14,
      paddingBottom: 10,
      gap: 6,
    },
    chip: {
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
    },
    chipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: withAlpha(theme.colors.primary, 0.14),
    },
    chipText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.4,
    },
    chipTextActive: { color: theme.colors.primary },
    overlay: { flex: 1, backgroundColor: withAlpha(theme.colors.scrim, 0.6), justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.modalBg,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      maxHeight: '88%',
      borderTopWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    body: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
    sectionGap: { height: theme.spacing.lg },
    langBadge: {
      color: theme.colors.primary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
    },
  });
