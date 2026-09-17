import React, { useMemo } from 'react';
import { ViewStyle } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { useTheme } from '../../theme';

/**
 * The themed bottom sheet every overlay in the app should mount through.
 *
 * Overlays existed as raw RN Modals before: slid from the bottom with no
 * drag, no rubber-banding, no snap points, a hard backdrop tap-to-close.
 * BottomSheetModal gives all of it; this wrapper exists so the theme
 * (background, handle colour) and the snap-point conventions are decided
 * once, not re-derived per overlay.
 *
 * Imperative-and-controlled: the parent holds a ref, calls `present()` /
 * `dismiss()`, and passes content as children. `useSheetVisible` adapts a
 * plain `visible` boolean for callers that prefer the declarative style.
 */
export type SheetProps = Omit<BottomSheetModalProps, 'theme'> & {
  /** Snap points as fractions or px. Defaults to one comfortable sheet. */
  snapPoints?: BottomSheetModalProps['snapPoints'];
};

export const Sheet = React.forwardRef<BottomSheetModal, SheetProps>(
  ({ snapPoints, style, children, ...rest }, ref) => {
    const { theme } = useTheme();

    const resolvedSnaps = useMemo(() => snapPoints ?? ['80%'], [snapPoints]);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={resolvedSnaps}
        backgroundStyle={{ backgroundColor: theme.colors.card }}
        handleIndicatorStyle={{
          backgroundColor: theme.colors.textMuted,
          width: 38,
          height: 4,
        }}
        style={style as ViewStyle | undefined}
        {...rest}
      >
        {/* Children render directly. They used to be wrapped in a
            BottomSheetView, which made every sheet that owns a
            BottomSheetScrollView (quick entry, trade detail) measure a
            scroll height of zero: the sheet opened on its handle with the
            content invisible. Nested scrollables inside a bottom sheet are
            not supported — the sheet itself already measures its children. */}
        {children as React.ReactNode}
      </BottomSheetModal>
    );
  }
);

Sheet.displayName = 'Sheet';

/** Sync a declarative `visible` boolean with the imperative modal API. */
export const useSheetVisible = (
  ref: React.RefObject<BottomSheetModal | null>,
  visible: boolean
): void => {
  React.useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [ref, visible]);
};
