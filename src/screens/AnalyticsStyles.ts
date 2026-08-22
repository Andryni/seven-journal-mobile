import { StyleSheet } from 'react-native';
import type { AppTheme } from '../theme';

export const createAnalyticsStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  screenTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: 1,
  },
  screenSubtitle: {
    color: theme.colors.textPrimary,
    fontSize: 10,
    fontFamily: theme.fonts.sansSemiBold,
    marginTop: 2,
  },
  tabsScroll: {
    marginBottom: theme.spacing.md,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    marginRight: theme.spacing.sm,
  },
  tabItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: theme.colors.primary,
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  tabContent: {
    paddingBottom: theme.spacing.xxl,
  },
  grid2: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  kpiLabel: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  kpiVal: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  greenText: {
    color: theme.colors.greenLight,
  },
  redText: {
    color: theme.colors.redLight,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomColor: theme.colors.cardBorder,
    borderBottomWidth: 1,
  },
  boldWhite: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: theme.fonts.sansBold,
  },
  boldVal: {
    fontSize: 13,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  subMuted: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  dateRangeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
  },
  dateRangeBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: theme.colors.primary,
  },
  dateRangeText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateRangeTextActive: {
    color: theme.colors.primaryLight,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  shareBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.5,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
    fontStyle: 'italic',
  },
});
