import { useT } from '../../i18n';
import type { MarketType, SizeUnit } from '../../utils/positionSizing';
import { unitForMarket } from '../../utils/positionSizing';

/**
 * Localised name of a position unit.
 *
 * Sizes are meaningless without their noun: "2" is two lots on a CFD account
 * and two contracts on a futures account, and those are different bets. Every
 * screen that prints a size should print this next to it.
 */
export function useSizeUnitLabel(unit: SizeUnit): string {
  const { t } = useT();
  if (unit === 'contract') return t('unitContract');
  if (unit === 'unit') return t('unitUnit');
  return t('unitLot');
}

/** Same, resolved from an account's market rather than a unit. */
export function useMarketUnitLabel(market: MarketType | null | undefined): string {
  return useSizeUnitLabel(unitForMarket(market));
}
