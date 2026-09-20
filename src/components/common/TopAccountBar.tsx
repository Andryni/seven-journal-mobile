import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useUIStore } from '../../store/uiStore';
import { useAccounts } from '../../features/accounts/useAccounts';
import { SettingsSheet } from '../settings/SettingsSheet';
import { withAlpha } from '../../theme';
import { useTheme } from '../../theme';
import { PressableScale } from '../ui/PressableScale';
import type { AppTheme } from '../../theme';
import { accountTypeLabel, useT } from '../../i18n';
import { Wallet, ChevronDown, Check, LogOut, Settings, Languages } from 'lucide-react-native';
import { supabase } from '../../api/supabaseClient';
import { formatCurrency, currencySymbol } from '../../utils/formatCurrency';
import { BrandWordmark } from '../brand/BrandWordmark';
import { unregisterPushToken } from '../../features/notifications/usePushServerAlerts';

export const TopAccountBar: React.FC = () => {
  const { theme } = useTheme();
  const { t, lang, toggleLang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const activeAccountId = useUIStore((state: { activeAccountId: string | null }) => state.activeAccountId);
  const setActiveAccountId = useUIStore((state: { setActiveAccountId: (id: string | null) => void }) => state.setActiveAccountId);
  const { accounts } = useAccounts();

  const [modalVisible, setModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const activeAccount = accounts.find(a => a.id === activeAccountId);

  /**
   * Sign out — after letting go of this device.
   *
   * The push registration belongs to the HANDSET: without this, a phone that
   * signs out keeps receiving alerts about the account it just left, until
   * someone logs in on it again. Best effort by design: an unregister that
   * fails (offline) must never be able to block signing out.
   */
  const handleSignOut = useCallback(async () => {
    try {
      await unregisterPushToken();
    } catch {
      // The token rebinds to whoever logs in next; nothing to repair here.
    }
    await supabase.auth.signOut();
  }, []);

  return (
    <View style={styles.container}>
      {/* Brand Logo & Name */}
      <View style={styles.brandRow}>
        <View style={styles.logoWrapper}>
          {/* The shipped artwork, keyed to transparency — one identity across
              launcher, splash and dashboard. */}
          <Image
            source={require('../../assets/seven_tracking_logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <View>
          <BrandWordmark
            fontSize={12}
            fontFamily={theme.fonts.sansExtraBold}
            letterSpacing={0.8}
            primaryColor={theme.colors.textPrimary}
            accentColor={theme.colors.primaryLight}
          />            <View style={styles.liveIndicatorRow}>
              <View style={styles.liveDot} />
              {/* numberOfLines: between the 36px logo and the account selector
                  there is no slack; a wrapped "TERMINAL" would be clipped by
                  the row height instead of ellipsizing visibly. */}
              <Text style={styles.terminalSub} numberOfLines={1}>
                FINTECH TERMINAL
              </Text>
            </View>
        </View>
      </View>

      {/* Account Selector Button */}
      <PressableScale
        style={styles.selectorBtn}
        onPress={() => setModalVisible(true)}
        accessibilityLabel={t('selectActiveAccount')}
      >
        <View style={styles.btnLeft}>
          <View style={styles.iconCircle}>
            <Wallet size={12} color={theme.colors.primaryLight} />
          </View>
          <View style={{ maxWidth: 120 }}>
            <Text style={styles.accountTitle} numberOfLines={1}>
              {activeAccount ? activeAccount.name.toUpperCase() : t('allAccounts')}
            </Text>
            <Text style={styles.accountSub} numberOfLines={1}>
              {activeAccount
                ? `${formatCurrency(activeAccount.balance, { symbol: currencySymbol(activeAccount.currency), showPlus: false, decimals: 0, thousandsSeparator: true })} ${activeAccount.currency}`
                : t('accountsCount', accounts.length)}
            </Text>
          </View>
        </View>
        <ChevronDown size={14} color={theme.colors.textSecondary} />
      </PressableScale>

      {/* Settings + Language + Logout quick access.
          The theme toggle was removed: the app is dark-only, so it was a
          button that did nothing. Settings took its slot. */}
      <View style={styles.actionsRow}>
        <PressableScale
          style={styles.iconBtn}
          onPress={() => setSettingsVisible(true)}
          accessibilityLabel={t('settings')}
        >
          <Settings size={14} color={theme.colors.textSecondary} strokeWidth={1.75} />
        </PressableScale>
        <PressableScale
          style={styles.iconBtn}
          onPress={toggleLang}
          accessibilityLabel={t('switchLanguage')}
        >
          <Languages size={14} color={theme.colors.textSecondary} />
          <Text style={styles.langText}>{lang.toUpperCase()}</Text>
        </PressableScale>
        <PressableScale
          style={styles.iconBtn}
          onPress={handleSignOut}
          accessibilityLabel={t('logout')}
        >
          <LogOut size={14} color={theme.colors.textMuted} />
        </PressableScale>
      </View>

      <SettingsSheet visible={settingsVisible} onClose={() => setSettingsVisible(false)} />

      {/* Account Selection Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[withAlpha(theme.colors.primary, 0.6), withAlpha(theme.colors.cyan, 0.4), 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalGlow}
            />

            <View style={styles.modalHeader}>
              <Text style={styles.modalHeading}>{t('selectActiveAccount')}</Text>
              <Text style={styles.modalSubheading}>{t('selectActiveAccountSub')}</Text>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {/* Option: Tous les comptes */}
              <TouchableOpacity
                style={[styles.accountItem, !activeAccountId && styles.accountItemActive]}
                onPress={() => {
                  setActiveAccountId(null);
                  setModalVisible(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: !activeAccountId }}
                accessibilityLabel={t('allAccounts')}
              >
                <View>
                  <Text style={[styles.accountItemName, !activeAccountId && styles.whiteText]}>
                    {t('allAccountsGlobal')}
                  </Text>
                  <Text style={styles.accountItemSub}>{t('allAccountsSub')}</Text>
                </View>
                {!activeAccountId && <Check size={16} color={theme.colors.primaryLight} />}
              </TouchableOpacity>

              {/* Comptes individuels */}
              {accounts.map(acc => {
                const isSelected = activeAccountId === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.accountItem, isSelected && styles.accountItemActive]}
                    onPress={() => {
                      setActiveAccountId(acc.id);
                      setModalVisible(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={acc.name}
                  >
                    <View>
                      <Text style={[styles.accountItemName, isSelected && styles.whiteText]}>
                        {acc.name.toUpperCase()}
                      </Text>
                      <Text style={styles.accountItemSub}>
                        {t('balance')}: {formatCurrency(acc.balance, { symbol: currencySymbol(acc.currency), showPlus: false, decimals: 0, thousandsSeparator: true })} {acc.currency} · {accountTypeLabel(t, acc.type)}
                      </Text>
                    </View>
                    {isSelected && <Check size={16} color={theme.colors.primaryLight} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    overflow: 'hidden',
    // No-Glow rule (DESIGN.md): the rail is a border, not a halo.
    borderWidth: 1.5,
    borderColor: theme.colors.cardBorderGlow,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.colors.greenLight,
  },
  terminalSub: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
    // Books Android's un-measured trailing letter-spacing gap, so "TERMINAL"
    // keeps its final L instead of losing it to the clip.
    paddingRight: 2,
  },
  selectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  btnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: withAlpha(theme.colors.primary, 0.15),
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountTitle: {
    color: theme.colors.textPrimary,
    fontSize: 10,
    fontFamily: theme.fonts.sansBold,
    letterSpacing: 0.4,
  },
  accountSub: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoMedium,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 8,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
  },
  langText: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: withAlpha(theme.colors.scrim, 0.85),
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.modalBg,
    borderColor: theme.colors.borderBright,
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    padding: theme.spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.8,
    shadowRadius: 25,
    elevation: 15,
  },
  modalGlow: {
    height: 2,
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  modalHeader: {
    marginBottom: theme.spacing.md,
  },
  modalHeading: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontFamily: theme.fonts.sansBold,
    letterSpacing: 0.8,
  },
  modalSubheading: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: theme.fonts.sans,
    marginTop: 3,
  },
  accountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  accountItemActive: {
    backgroundColor: withAlpha(theme.colors.primary, 0.15),
    borderColor: theme.colors.primary,
  },
  accountItemName: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontFamily: theme.fonts.sansBold,
  },
  accountItemSub: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.sansMedium,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  whiteText: {
    color: theme.colors.textPrimary,
  },
});
