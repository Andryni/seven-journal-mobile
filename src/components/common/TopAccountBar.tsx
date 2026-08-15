import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { useUIStore } from '../../store/uiStore';
import { useAccounts } from '../../features/accounts/useAccounts';
import { theme } from '../../theme';
import { Wallet, ChevronDown, Check, LogOut } from 'lucide-react-native';
import { supabase } from '../../api/supabaseClient';

export const TopAccountBar: React.FC = () => {
  const activeAccountId = useUIStore((state: { activeAccountId: string | null }) => state.activeAccountId);
  const setActiveAccountId = useUIStore((state: { setActiveAccountId: (id: string | null) => void }) => state.setActiveAccountId);
  const { accounts } = useAccounts();

  const [modalVisible, setModalVisible] = useState(false);

  const activeAccount = accounts.find(a => a.id === activeAccountId);

  return (
    <View style={styles.container}>
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
          <View>
            <Text style={styles.accountTitle}>
              {activeAccount ? activeAccount.name.toUpperCase() : 'TOUS LES COMPTES'}
            </Text>
            <Text style={styles.accountSub}>
              {activeAccount
                ? `$${activeAccount.balance.toLocaleString()} ${activeAccount.currency} · ${activeAccount.type.toUpperCase()}`
                : `${accounts.length} COMPTE(S) ACTIF(S)`}
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
            <Text style={styles.modalHeading}>SÉLECTIONNER LE COMPTE ACTIF</Text>
            <Text style={styles.modalSubheading}>
              Filtre instantanément l'intégralité du terminal (trades, KPIs, graphiques).
            </Text>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
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
    backgroundColor: '#0d0e14',
    borderBottomWidth: 1,
    borderBottomColor: '#262833',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  selectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#14161f',
    borderColor: '#262833',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountTitle: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  accountSub: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    marginTop: 1,
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: '#14161f',
    borderColor: '#262833',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: '#181920',
    borderColor: '#262833',
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
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
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  accountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#121318',
    borderColor: '#262833',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    marginBottom: 6,
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
  },
  whiteText: {
    color: '#ffffff',
  },
});
