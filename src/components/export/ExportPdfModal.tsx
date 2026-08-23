import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, FileText, Download, Check, Calendar, Wallet } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { localeFor, useT } from '../../i18n';
import type { Trade, TradingAccount } from '../../types/domain';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatTradeDuration, classifyTradeStyle } from '../../utils/formatDate';

interface ExportPdfModalProps {
  visible: boolean;
  onClose: () => void;
  accounts: TradingAccount[];
  trades: Trade[];
}

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  visible,
  onClose,
  accounts,
  trades,
}) => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedRange, setSelectedRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [isGenerating, setIsGenerating] = useState(false);

  // Filter trades according to account and range
  const filteredTrades = useMemo(() => {
    let result = [...trades];
    if (selectedAccountId !== 'all') {
      result = result.filter(tr => tr.account_id === selectedAccountId);
    }

    const now = Date.now();
    if (selectedRange === '7d') {
      const cutoff = now - 7 * 86400000;
      result = result.filter(tr => new Date(tr.entry_time).getTime() >= cutoff);
    } else if (selectedRange === '30d') {
      const cutoff = now - 30 * 86400000;
      result = result.filter(tr => new Date(tr.entry_time).getTime() >= cutoff);
    } else if (selectedRange === '90d') {
      const cutoff = now - 90 * 86400000;
      result = result.filter(tr => new Date(tr.entry_time).getTime() >= cutoff);
    }

    return result.sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime());
  }, [trades, selectedAccountId, selectedRange]);

  const closedTrades = useMemo(() => filteredTrades.filter(t => t.pnl !== null), [filteredTrades]);

  // Compute key KPIs
  const totalPnL = useMemo(() => closedTrades.reduce((sum, tr) => sum + (tr.pnl || 0), 0), [closedTrades]);
  const wins = useMemo(() => closedTrades.filter(tr => (tr.pnl || 0) > 0), [closedTrades]);
  const losses = useMemo(() => closedTrades.filter(tr => (tr.pnl || 0) < 0), [closedTrades]);
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
  const grossProfit = wins.reduce((sum, tr) => sum + (tr.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, tr) => sum + (tr.pnl || 0), 0));
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '99.9' : '0.00';

  // Build Equity Points for SVG chart inside PDF
  const equityPoints = useMemo(() => {
    const sorted = [...closedTrades].reverse();
    let cum = 0;
    const pts: number[] = [0];
    for (const tr of sorted) {
      cum += (tr.pnl || 0);
      pts.push(cum);
    }
    return pts;
  }, [closedTrades]);

  const generateSvgChart = () => {
    if (equityPoints.length < 2) return '';
    const width = 600;
    const height = 180;
    const minVal = Math.min(...equityPoints);
    const maxVal = Math.max(...equityPoints);
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    const pointsStr = equityPoints.map((val, idx) => {
      const x = (idx / (equityPoints.length - 1)) * (width - 40) + 20;
      const y = height - 20 - ((val - minVal) / range) * (height - 40);
      return `${x},${y}`;
    }).join(' ');

    const strokeColor = totalPnL >= 0 ? '#10B981' : '#EF4444';

    const firstX = 20;
    const lastX = width - 20;
    const bottomY = height - 10;
    const polygonPoints = `${firstX},${bottomY} ${pointsStr} ${lastX},${bottomY}`;

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="width: 100%; max-width: 600px; height: auto; margin: 15px 0;">
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <polygon points="${polygonPoints}" fill="url(#grad)" />
        <polyline fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${pointsStr}" />
      </svg>
    `;
  };

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    try {
      const selectedAccountName = selectedAccountId === 'all'
        ? t('pdfAllAccountsCombined')
        : accounts.find(a => a.id === selectedAccountId)?.name || 'Account';

      const rangeLabel = selectedRange === '7d' ? t('pdf7Days')
        : selectedRange === '30d' ? t('pdf30Days')
        : selectedRange === '90d' ? t('pdf90Days') : t('pdfAllTime');

      const tradeRowsHtml = closedTrades.map((tr, idx) => {
        const pnl = tr.pnl || 0;
        const isPos = pnl >= 0;
        const color = isPos ? '#10B981' : '#EF4444';
        const dateStr = new Date(tr.entry_time).toLocaleDateString(localeFor(lang), { day: '2-digit', month: 'short' });
        const rVal = tr.r_multiple !== null && tr.r_multiple !== undefined ? `${tr.r_multiple > 0 ? '+' : ''}${tr.r_multiple.toFixed(2)}R` : '—';
        const setupStr = tr.setup_structures?.join(', ') || 'Standard';

        return `
          <tr style="border-bottom: 1px solid #1E293B; font-size: 11px;">
            <td style="padding: 8px 6px; color: #94A3B8;">${idx + 1}</td>
            <td style="padding: 8px 6px; font-weight: 600; color: #F8FAFC;">${dateStr}</td>
            <td style="padding: 8px 6px; font-weight: 700; color: #38BDF8;">${tr.pair}</td>
            <td style="padding: 8px 6px; font-weight: 700; color: ${tr.direction === 'BUY' ? '#10B981' : '#EF4444'};">${tr.direction}</td>
            <td style="padding: 8px 6px; color: #94A3B8;">${tr.timeframe}</td>
            <td style="padding: 8px 6px; color: #CBD5E1;">${tr.size}</td>
            <td style="padding: 8px 6px; color: #94A3B8;">${setupStr}</td>
            <td style="padding: 8px 6px; text-align: right; font-weight: 700; color: ${color};">${formatCurrency(pnl)}</td>
            <td style="padding: 8px 6px; text-align: right; font-weight: 700; color: ${color};">${rVal}</td>
          </tr>
        `;
      }).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Seven Journal - Trading Performance Report</title>
          <style>
            @page { margin: 20mm; size: A4 portrait; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background-color: #0B0E14;
              color: #F8FAFC;
              margin: 0;
              padding: 20px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #38BDF8;
              padding-bottom: 14px;
              margin-bottom: 20px;
            }
            .logo {
              font-size: 22px;
              font-weight: 900;
              letter-spacing: 1px;
              color: #F8FAFC;
            }
            .logo span { color: #38BDF8; }
            .badge {
              background: #1E293B;
              border: 1px solid #334155;
              padding: 4px 10px;
              border-radius: 6px;
              font-size: 11px;
              color: #94A3B8;
            }
            .grid-kpis {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 24px;
            }
            .kpi-card {
              background: #111622;
              border: 1px solid #1E293B;
              border-radius: 8px;
              padding: 12px;
            }
            .kpi-title {
              font-size: 10px;
              font-weight: 700;
              color: #64748B;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .kpi-value {
              font-size: 18px;
              font-weight: 900;
            }
            .green { color: #10B981; }
            .red { color: #EF4444; }
            .cyan { color: #38BDF8; }
            .gold { color: #F59E0B; }
            .section-title {
              font-size: 13px;
              font-weight: 800;
              color: #94A3B8;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 20px 0 10px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
            }
            th {
              background: #111622;
              color: #64748B;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              padding: 8px 6px;
              text-align: left;
              border-bottom: 1px solid #334155;
            }
            .footer {
              margin-top: 30px;
              border-top: 1px solid #1E293B;
              padding-top: 10px;
              text-align: center;
              font-size: 10px;
              color: #475569;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">SEVEN<span>JOURNAL</span></div>
              <div style="font-size: 12px; color: #64748B; margin-top: 2px;">${t('pdfReportSubtitle')}</div>
            </div>
            <div style="text-align: right;">
              <div class="badge">${selectedAccountName}</div>
              <div style="font-size: 10px; color: #64748B; margin-top: 4px;">${t('pdfPeriodLabel')} : ${rangeLabel}</div>
            </div>
          </div>

          <!-- KEY METRICS -->
          <div class="grid-kpis">
            <div class="kpi-card">
              <div class="kpi-title">NET REALIZED P&L</div>
              <div class="kpi-value ${totalPnL >= 0 ? 'green' : 'red'}">${formatCurrency(totalPnL)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">WIN RATE</div>
              <div class="kpi-value cyan">${winRate.toFixed(1)}% <span style="font-size: 11px; font-weight: normal; color: #64748B;">(${wins.length}W / ${losses.length}L)</span></div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">PROFIT FACTOR</div>
              <div class="kpi-value gold">${profitFactor}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">TOTAL POSITIONS</div>
              <div class="kpi-value" style="color: #F8FAFC;">${closedTrades.length} trades</div>
            </div>
          </div>

          <!-- EQUITY CURVE -->
          <div class="section-title">📈 Equity Growth & Drawdown Profile</div>
          <div style="background: #111622; border: 1px solid #1E293B; border-radius: 8px; padding: 10px; text-align: center;">
            ${generateSvgChart() || `<p style="color: #64748B; font-size: 12px;">${t('pdfNoDataChart')}</p>`}
          </div>

          <!-- TRADE LOGS -->
          <div class="section-title">📑 Trade History & Execution Logs (${closedTrades.length})</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Pair</th>
                <th>Dir</th>
                <th>TF</th>
                <th>Vol</th>
                <th>Setup</th>
                <th style="text-align: right;">P&L ($)</th>
                <th style="text-align: right;">R:R</th>
              </tr>
            </thead>
            <tbody>
              ${tradeRowsHtml || `<tr><td colspan="9" style="text-align:center; padding: 15px; color: #64748B;">${t('pdfNoTrades')}</td></tr>`}
            </tbody>
          </table>

          <div class="footer">
            ${t('pdfFooter')}
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      // On Android / Expo Go, sharing cache files directly can be rejected. Copy to permanent documentDirectory:
      const fileName = `SevenJournal_Report_${selectedRange}_${Date.now()}.pdf`;
      const targetUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: uri, to: targetUri });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(targetUri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: t('pdfExportTitle'),
        });
      } else {
        Alert.alert(t('pdfExportTitle'), `PDF exporté: ${targetUri}`);
      }
      onClose();
    } catch (err: any) {
      Alert.alert(t('pdfErrorTitle'), err?.message || t('pdfErrorGenerate'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <FileText size={18} color={theme.colors.primaryLight} />
              <Text style={styles.title}>{t('pdfExportTitle')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Account Filter */}
          <Text style={styles.sectionLabel}>{t('pdfChooseAccount')}</Text>
          <View style={styles.optionsWrap}>
            <TouchableOpacity
              style={[styles.pillOption, selectedAccountId === 'all' && styles.pillOptionActive]}
              onPress={() => setSelectedAccountId('all')}
            >
              <Wallet size={12} color={selectedAccountId === 'all' ? '#fff' : theme.colors.textMuted} />
              <Text style={[styles.pillText, selectedAccountId === 'all' && styles.whiteText]}>
                {t('pdfAllAccounts')}
              </Text>
            </TouchableOpacity>

            {accounts.map(acc => (
              <TouchableOpacity
                key={acc.id}
                style={[styles.pillOption, selectedAccountId === acc.id && styles.pillOptionActive]}
                onPress={() => setSelectedAccountId(acc.id)}
              >
                <Text style={[styles.pillText, selectedAccountId === acc.id && styles.whiteText]}>
                  {acc.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Period Filter */}
          <Text style={styles.sectionLabel}>{t('pdfReportPeriod')}</Text>
          <View style={styles.optionsWrap}>
            {[
              { key: '7d', label: `${t('pdf7Days')} / 7d` },
              { key: '30d', label: `${t('pdf30Days')} / 30d` },
              { key: '90d', label: `${t('pdf90Days')} / 90d` },
              { key: 'all', label: t('pdfAllHistory') },
            ].map(range => (
              <TouchableOpacity
                key={range.key}
                style={[styles.pillOption, selectedRange === range.key && styles.pillOptionActive]}
                onPress={() => setSelectedRange(range.key as any)}
              >
                <Calendar size={12} color={selectedRange === range.key ? '#fff' : theme.colors.textMuted} />
                <Text style={[styles.pillText, selectedRange === range.key && styles.whiteText]}>
                  {range.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary Preview */}
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>
              📊 {closedTrades.length} trades · P&L: <Text style={{ color: totalPnL >= 0 ? theme.colors.greenLight : theme.colors.redLight, fontWeight: '800' }}>{formatCurrency(totalPnL)}</Text>
            </Text>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.generateBtn, isGenerating && { opacity: 0.7 }]}
            onPress={handleGeneratePdf}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Download size={16} color="#fff" />
                <Text style={styles.generateBtnText}>
                  {t('pdfGenerateShare')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      padding: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
      paddingBottom: 12,
    },
    title: {
      color: theme.colors.textPrimary,
      fontFamily: theme.fonts.sansBold,
      fontSize: 14,
      letterSpacing: 0.5,
    },
    closeBtn: {
      padding: 4,
    },
    sectionLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontFamily: theme.fonts.monoBold,
      marginBottom: 8,
      marginTop: 6,
    },
    optionsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    pillOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    pillOptionActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primaryLight,
    },
    pillText: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontFamily: theme.fonts.sansBold,
    },
    whiteText: {
      color: '#ffffff',
    },
    previewBox: {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      alignItems: 'center',
      marginBottom: 16,
    },
    previewText: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontFamily: theme.fonts.monoBold,
    },
    generateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      paddingVertical: 14,
      borderRadius: 10,
    },
    generateBtnText: {
      color: '#ffffff',
      fontFamily: theme.fonts.sansBold,
      fontSize: 12,
      letterSpacing: 0.5,
    },
  });
