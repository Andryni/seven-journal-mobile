import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useUIStore } from '../../store/uiStore';
import { useAccounts } from '../../features/accounts/useAccounts';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { accountTypeLabel, useT } from '../../i18n';
import { SevenLogo } from './SevenLogo';
import { Wallet, ChevronDown, Check, LogOut, Sun, Moon, Languages } from 'lucide-react-native';
import { supabase } from '../../api/supabaseClient';
import { formatCurrency } from '../../utils/formatCurrency';

export const TopAccountBar: React.FC = () => {
  const { theme, mode, toggleTheme } = useTheme();
  const { t, lang, toggleLang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const activeAccountId = useUIStore((state: { activeAccountId: string | null }) => state.activeAccountId);
  const setActiveAccountId = useUIStore((state: { setActiveAccountId: (id: string | null) => void }) => state.setActiveAccountId);
  const { accounts } = useAccounts();

  const [modalVisible, setModalVisible] = useState(false);

  const activeAccount = accounts.find(a => a.id === activeAccountId);

  return (
    <View style={styles.container}>
      {/* Brand Logo & Name */}
      <View style={styles.brandRow}>
        <View style={styles.logoWrapper}>
          <Image
            source={require('../../assets/seven_tracking_logo.png')}
            style={{ width: 34, height: 34, borderRadius: 8 }}
            resizeMode="cover"
          />
        </View>
        <View>
          <View style={styles.flexRow}>
            <Text style={styles.brandTextSeven}>SEVEN </Text>
            <Text style={styles.brandTextTerminal}>JOURNAL</Text>
          </View>
          <View style={styles.liveIndicatorRow}>
            <View style={styles.liveDot} />
            <Text style={styles.terminalSub}>FINTECH TERMINAL</Text>
          </View>
        </View>
      </View>

      {/* Account Selector Button */}
      <TouchableOpacity
        style={styles.selectorBtn}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
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
                ? `${formatCurrency(activeAccount.balance, { showPlus: false, decimals: 0, thousandsSeparator: true })} ${activeAccount.currency}`
                : t('accountsCount', accounts.length)}
            </Text>
          </View>
        </View>
        <ChevronDown size={14} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      {/* Theme + Language + Logout quick access */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={toggleTheme}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('switchTheme')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {mode === 'dark' ? (
            <Sun size={14} color={theme.colors.goldLight} />
          ) : (
            <Moon size={14} color={theme.colors.primaryLight} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={toggleLang}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('switchLanguage')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Languages size={14} color={theme.colors.textSecondary} />
          <Text style={styles.langText}>{lang.toUpperCase()}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => supabase.auth.signOut()}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('logout')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <LogOut size={14} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Account Selection Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.6)', 'rgba(6, 182, 212, 0.4)', 'transparent']}
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
                  >
                    <View>
                      <Text style={[styles.accountItemName, isSelected && styles.whiteText]}>
                        {acc.name.toUpperCase()}
                      </Text>
                      <Text style={styles.accountItemSub}>
                        {t('balance')}: {formatCurrency(acc.balance, { showPlus: false, decimals: 0, thousandsSeparator: true })} {acc.currency} · {accountTypeLabel(t, acc.type)}
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
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  logoImg: {
    width: 36,
    height: 36,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTextSeven: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: 0.8,
  },
  brandTextTerminal: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: 0.8,
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
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
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
    backgroundColor: 'rgba(0,0,0,0.85)',
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
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
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
