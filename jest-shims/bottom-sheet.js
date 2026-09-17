/* eslint-disable */
/**
 * Bottom-sheet stand-in for render tests.
 *
 * The real BottomSheetModal requires the Reanimated native runtime and calls
 * `Reanimated.addWhitelistedUIProps` at module scope — an API that no longer
 * exists in Reanimated 4, so the import chain dies before a test renders a
 * single node. The shim maps the modal and scroll-view onto ordinary Views:
 * present/dismiss become no-ops, children always render, which is exactly
 * what the render tests assert on (content, a11y labels, handlers).
 *
 * The imperative API is kept on the forwarded ref so `useSheetVisible` and
 * any component calling `ref.current?.present()` do not need to know.
 */
const React = require('react');
const { View, ScrollView } = require('react-native');

const noop = () => {};

const attachImperative = (ref, instance) => {
  if (!ref || typeof ref !== 'object') return;
  ref.current = {
    present: noop,
    dismiss: noop,
    close: noop,
    snapToIndex: noop,
    expand: noop,
    collapse: noop,
    forceClose: noop,
    ...instance,
  };
};

const BottomSheetModal = React.forwardRef((props, ref) => {
  attachImperative(ref, {});
  return React.createElement(
    View,
    { testID: props.testID ?? 'bottom-sheet-modal' },
    React.Children.toArray(props.children)
  );
});
BottomSheetModal.displayName = 'BottomSheetModal';

const BottomSheetView = props =>
  React.createElement(
    View,
    { testID: props.testID ?? 'bottom-sheet-view', style: props.style },
    React.Children.toArray(props.children)
  );
BottomSheetView.displayName = 'BottomSheetView';

const BottomSheetScrollView = props =>
  React.createElement(
    ScrollView,
    {
      testID: props.testID ?? 'bottom-sheet-scrollview',
      style: props.style,
      contentContainerStyle: props.contentContainerStyle,
      showsVerticalScrollIndicator: props.showsVerticalScrollIndicator,
      keyboardShouldPersistTaps: props.keyboardShouldPersistTaps,
    },
    React.Children.toArray(props.children)
  );
BottomSheetScrollView.displayName = 'BottomSheetScrollView';

const BottomSheet = props =>
  React.createElement(View, null, React.Children.toArray(props.children));
BottomSheet.displayName = 'BottomSheet';

const BottomSheetBackdrop = () => null;
BottomSheetBackdrop.displayName = 'BottomSheetBackdrop';

module.exports = {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheet,
  BottomSheetBackdrop,
  // Constants read by consumer styling code.
  MODAL_STACK_BEHAVIOR: 'pop',
  SHEET_STATE_OPEN: 2,
  SHEET_STATE_CLOSED: 0,
  // Hooks some deep import might touch; all inert here.
  useBottomSheet: () => ({
    expand: noop,
    collapse: noop,
    close: noop,
    snapToIndex: noop,
  }),
  useBottomSheetModal: () => ({ present: noop, dismiss: noop, close: noop }),
};
