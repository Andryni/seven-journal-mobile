import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, Modal } from 'react-native';
import { AlertTriangle, KeyRound, Pause,  Play,
  FileDown, Pencil, X } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { withAlpha } from '../../theme';
import { useT } from '../../i18n';
import { PressableScale } from '../ui/PressableScale';
import { formatDuration } from '../../utils/formatDate';
import {
  CONNECTOR_LABEL_MAX,
  connectorLabelIssue,
  normalizeConnectorLabel,
} from '../../features/sync/connectorManage';
import { connectorHealth, silenceMs } from '../../features/sync/connectorHealth';
import { eaSupport, eaVersionLabel } from '../../features/sync/eaVersion';
import type { IngestAccountRow } from '../../features/sync/useSyncQueue';
import { shareEaFile } from '../../features/sync/shareEaFile';
import { EA_SHIPPED_LABEL } from '../../features/sync/eaVersion';

/**
 * Managing one connector, without touching what it stands for.
 *
 * Both repairs a feed actually needs — a name that describes it and a secret
 * that is no longer trustworthy — used to require DELETING the connector and
 * creating it again, which cascades into its staging queue, drops the
 * provenance of every trade it promoted and forces the trader to re-route the
 * account. Neither operation needs any of that, so neither does this sheet:
 * it renames in place, rotates in place, and can only ever PAUSE a feed, never
 * remove one.
 *
 * Presentational on purpose: every action is a prop, the screen owns the
 * mutations and closes the sheet. That keeps the rules (empty name, duplicate
 * name, a rotation that must be confirmed) testable here, and the network
 * concerns in the hook where every other sync mutation lives.
 */
export const ConnectorSheet: React.FC<{
  connector: IngestAccountRow;
  /** Every OTHER connector's label, for the duplicate-name check. */
  otherLabels: string[];
  /** Back-fill requests the terminal has not answered yet. */
  pendingRequests: number;
  /** A mutation is in flight: buttons disable rather than queue two writes. */
  isBusy: boolean;
  onRename: (label: string) => void;
  onRotateSecret: () => void;
  onToggleActive: () => void;
  onClose: () => void;
}> = ({
  connector,
  otherLabels,
  pendingRequests,
  isBusy,
  onRename,
  onRotateSecret,
  onToggleActive,
  onClose,
}) => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [draft, setDraft] = useState(connector.label);

  // Re-seed when the sheet is reused for another connector, and when a rename
  // lands (the server's stored value is the truth, not what was typed).
  useEffect(() => {
    setDraft(connector.label);
  }, [connector.id, connector.label]);

  const issue = connectorLabelIssue(draft, otherLabels);
  const unchanged = normalizeConnectorLabel(draft) === normalizeConnectorLabel(connector.label);
  const canSave = !isBusy && !unchanged && issue === null;

  const issueText =
    issue === 'empty'
      ? t('syncManageNameEmpty')
      : issue === 'too_long'
        ? t('syncManageNameTooLong', String(CONNECTOR_LABEL_MAX))
        : issue === 'duplicate'
          ? t('syncManageNameTaken')
          : null;

  const health = connectorHealth(connector);
  const silent = silenceMs(connector);

  /**
   * The attached build, and whether it can answer a completion request. The
   * sheet is where the trader looks when something does not work, so the
   * upgrade instruction belongs here rather than only in the docs.
   */
  const support = eaSupport(connector);
  const eaLabel = eaVersionLabel(connector.ea_version);

  /**
   * Handing over the file. Each outcome gets its own sentence: "impossible" for
   * a platform without a share sheet and "not found" for a build that lost the
   * asset are different problems, and a single generic failure would send the
   * trader looking in the wrong place.
   */
  const onShareEa = async () => {
    const result = await shareEaFile();
    if (result === 'shared') return;
    Alert.alert(
      t('syncShareEa'),
      result === 'unsupported' ? t('syncShareEaUnsupported') : t('syncShareEaMissing')
    );
  };
  const eaLine =
    support === 'never'
      ? null
      : support === 'current'
        ? t('syncManageEaCurrent', eaLabel ?? '')
        : support === 'legacy'
          ? t('syncConnectorEaTooOld', eaLabel ?? '')
          : support === 'unreported'
            ? t('syncConnectorEaUnknown')
            : t('syncConnectorEaLiveOnly', eaLabel ?? '');
  const eaNeedsUpgrade = support !== 'never' && support !== 'current';
  // Silence is only worth a sentence once it IS silence: a connector whose
  // heartbeat is ten seconds old has nothing to report.
  const silenceText =
    health === 'quiet' && connector.last_sync_at
      ? formatDuration(connector.last_sync_at, new Date().toISOString(), lang)
      : null;

  /**
   * Rotation is the one action here that can quietly break a working feed:
   * the terminal keeps posting the OLD secret and gets a 401 until someone
   * pastes the new one into it. A confirmation that says exactly that is the
   * difference between a repair and a mystery.
   */
  const confirmRotate = () => {
    Alert.alert(t('syncManageRotateConfirmTitle'), t('syncManageRotateConfirmBody'), [
      { text: t('confirmNo'), style: 'cancel' },
      { text: t('syncManageRotate'), style: 'destructive', onPress: onRotateSecret },
    ]);
  };

  // A real Modal, not an absolutely positioned view inside the screen's
  // ScrollView: the connector rows can sit below the fold, and an overlay
  // anchored to the content box would open off-screen.
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {connector.label}
              </Text>
              <Text style={styles.sub}>
                {connector.platform === 'ctrader'
                  ? 'cTrader'
                  : connector.platform.startsWith('mt4')
                    ? 'MT4'
                    : connector.platform.startsWith('csv')
                      ? 'CSV'
                      : 'MT5'}
                {silenceText ? ` · ${t('syncConnectorQuiet', silenceText)}` : ''}
              </Text>
            </View>
            <PressableScale
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel={t('closeLabel')}
            >
              <X size={16} color={theme.colors.textPrimary} strokeWidth={2} />
            </PressableScale>
          </View>

          {/* ------------------------------------------------------ rename --- */}
          <Text style={styles.fieldLabel}>{t('syncManageRenameLabel')}</Text>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('syncManageRenamePlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            maxLength={CONNECTOR_LABEL_MAX + 20}
            accessibilityLabel={t('syncManageRenameLabel')}
            editable={!isBusy}
          />
          <Text style={[styles.hint, issueText ? styles.hintError : null]}>
            {issueText ?? t('syncManageRenameHint')}
          </Text>
          <PressableScale
            style={[styles.primaryBtn, !canSave && styles.btnOff]}
            onPress={() => onRename(normalizeConnectorLabel(draft))}
            disabled={!canSave}
          >
            <Pencil size={13} color={theme.colors.background} strokeWidth={2.2} />
            <Text style={styles.primaryBtnText}>{t('syncManageRenameAction')}</Text>
          </PressableScale>

          {/* ------------------------------------------------------ secret --- */}
          <View style={styles.divider} />
          <Text style={styles.fieldLabel}>{t('syncManageSecretLabel')}</Text>
          <Text style={styles.hint}>{t('syncManageSecretHint')}</Text>
          <PressableScale
            style={[styles.outlineBtn, isBusy && styles.btnOff]}
            onPress={confirmRotate}
            disabled={isBusy}
            accessibilityLabel={t('syncManageRotate')}
          >
            <KeyRound size={13} color={theme.colors.goldLight} strokeWidth={2} />
            <Text style={styles.outlineBtnText}>{t('syncManageRotate')}</Text>
          </PressableScale>

          {/* -------------------------------------------------------- feed --- */}
          <View style={styles.divider} />
          <View style={styles.feedRow}>
            <AlertTriangle
              size={13}
              color={connector.is_active ? theme.colors.green : theme.colors.gold}
              strokeWidth={2}
            />
            <Text style={styles.feedText}>
              {connector.is_active ? t('syncManageFeedActive') : t('syncManageFeedPaused')}
            </Text>
          </View>
          <PressableScale
            style={[styles.outlineBtn, isBusy && styles.btnOff]}
            onPress={onToggleActive}
            disabled={isBusy}
            accessibilityLabel={connector.is_active ? t('syncManagePause') : t('syncManageResume')}
          >
            {connector.is_active ? (
              <Pause size={13} color={theme.colors.textSecondary} strokeWidth={2} />
            ) : (
              <Play size={13} color={theme.colors.green} strokeWidth={2} />
            )}
            <Text style={styles.outlineBtnText}>
              {connector.is_active ? t('syncManagePause') : t('syncManageResume')}
            </Text>
          </PressableScale>

          {/* ---------------------------------------------------- terminal --- */}
          <View style={styles.divider} />
          <Text style={styles.hint}>
            {pendingRequests > 0
              ? t('syncManageRequestsPending', String(pendingRequests))
              : t('syncManageRequestsNone')}
          </Text>
          {eaLine ? (
            <Text style={[styles.hint, eaNeedsUpgrade ? styles.hintWarn : null]}>{eaLine}</Text>
          ) : null}
          {eaNeedsUpgrade ? (
            <Text style={styles.hint}>{t('syncManageEaUpgradeHint')}</Text>
          ) : null}

          {/* ---------------------------------------- le fichier lui-meme ---
              The version warning above says a terminal is too old. Until now
              that was a dead end on the phone: the fix lived in the
              repository, on a desktop. The EA is bundled with the app, so the
              sheet can hand it over here — share sheet, save, mail it, send it
              to the VPS. */}
          <PressableScale
            style={[styles.outlineBtn, isBusy && styles.btnOff]}
            onPress={onShareEa}
            disabled={isBusy}
            accessibilityLabel={t('syncShareEa')}
          >
            <FileDown size={13} color={theme.colors.primaryLight} strokeWidth={2} />
            <Text style={styles.outlineBtnText}>{t('syncShareEa', EA_SHIPPED_LABEL)}</Text>
          </PressableScale>
          <Text style={styles.hint}>{t('syncShareEaHint')}</Text>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: withAlpha(theme.colors.background, 0.92),
      padding: theme.spacing.lg,
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.textMuted, 0.2),
      gap: 8,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    closeBtn: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.textMuted, 0.2),
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontFamily: theme.fonts.sansExtraBold,
    },
    sub: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: withAlpha(theme.colors.textMuted, 0.15),
      marginVertical: 6,
    },
    fieldLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    input: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.textMuted, 0.2),
      borderRadius: 8,
      color: theme.colors.textPrimary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.mono,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    hint: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
    },
    hintError: { color: theme.colors.redLight },
    hintWarn: { color: theme.colors.goldLight },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 11,
    },
    primaryBtnText: {
      color: theme.colors.background,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    outlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.textMuted, 0.25),
      borderRadius: 8,
      paddingVertical: 11,
    },
    outlineBtnText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    btnOff: { opacity: 0.45 },
    feedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    feedText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      lineHeight: 15,
    },
  });
