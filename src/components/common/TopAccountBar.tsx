import React, { useState } from 'react';
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
import { theme } from '../../theme';
import { Wallet, ChevronDown, Check, LogOut, Sparkles } from 'lucide-react-native';
import { supabase } from '../../api/supabaseClient';

export const TopAccountBar: React.FC = () => {
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
            style={styles.logoImg}
            resizeMode="cover"
          />
        </View>
        <View>
          <View style={styles.flexRow}>
            <Text style={styles.brandTextSeven}>SEVEN </Text>
            <Text style={styles.brandTextTerminal}>TRACKING</Text>
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
              {activeAccount ? activeAccount.name.toUpperCase() : 'TOUS COMPTES'}
            </Text>
            <Text style={styles.accountSub} numberOfLines={1}>
              {activeAccount
                ? `$${activeAccount.balance.toLocaleString()} ${activeAccount.currency}`
                : `${accounts.length} COMPTES`}
            </Text>
          </View>
        </View>
        <ChevronDown size={14} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      {/* Logout button quick access */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => supabase.auth.signOut()}
        activeOpacity={0.8}
      >
        <LogOut size={14} color={theme.colors.textMuted} />
      </TouchableOpacity>

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
              <Text style={styles.modalHeading}>SÉLECTIONNER LE COMPTE ACTIF</Text>
              <Text style={styles.modalSubheading}>
                Filtre instantanément l'intégralité du terminal (trades, KPIs, graphiques).
              </Text>
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
                    🌐 TOUS LES COMPTES (VUE GLOBALE)
                  </Text>
                  <Text style={styles.accountItemSub}>
                    Cumul de l'ensemble de vos positions
                  </Text>
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
                        💼 {acc.name.toUpperCase()}
                      </Text>
                      <Text style={styles.accountItemSub}>
                        Solde: ${acc.balance.toLocaleString()} {acc.currency} · {acc.type.toUpperCase()}
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#07080a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
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
    width: 32,
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  logoImg: {
    width: 32,
    height: 32,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTextSeven: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  brandTextTerminal: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: '900',
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
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  selectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#14161f',
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  accountSub: {
    color: theme.colors.textSecondary,
    fontSize: 8,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: '#14161f',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: '#181920',
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  modalSubheading: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },
  accountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#121318',
    borderColor: '#262833',
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
    fontWeight: '800',
  },
  accountItemSub: {
    color: theme.colors.textMuted,
    fontSize: 9,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  whiteText: {
    color: '#ffffff',
  },
});
