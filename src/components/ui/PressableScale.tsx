import React, { useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
  GestureResponderEvent,
  AccessibilityState,
} from 'react-native';
import { hapticLight } from '../../utils/haptics';

interface PressableScaleProps {
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  /** Scale when pressed (default 0.96) */
  pressedScale?: number;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'tab';
  /** Announce toggle state (selected/checked) to screen readers. */
  accessibilityState?: AccessibilityState;
  hitSlop?: number;
}

/**
 * Tactile pressable with a springy scale-down — gives every touchable
 * element a premium native feel instead of a flat opacity change.
 */
export const PressableScale: React.FC<PressableScaleProps> = ({
  onPress,
  onLongPress,
  disabled,
  style,
  children,
  pressedScale = 0.96,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  hitSlop,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  /**
   * Layout lives on the Pressable, painting lives on the Animated.View.
   *
   * The style prop used to be applied only to the inner Animated.View, so a
   * caller passing `flex: 1` sized that inner box while the Pressable itself
   * stayed wrapped around its content. Two such buttons in a row therefore
   * hugged their labels and sat bunched together instead of splitting the row
   * -- which is why the share sheet's Save / Export pair looked off-centre.
   *
   * Flex and self-alignment have to reach the outer element to have any
   * meaning; everything else stays inside so the scale animation keeps
   * transforming the visible box.
   */
  const [outerStyle, innerStyle] = useMemo(() => {
    const flat = StyleSheet.flatten(style) ?? {};
    const { flex, flexGrow, flexShrink, flexBasis, alignSelf, width, ...rest } =
      flat as ViewStyle;
    const outer: ViewStyle = {};
    if (flex !== undefined) outer.flex = flex;
    if (flexGrow !== undefined) outer.flexGrow = flexGrow;
    if (flexShrink !== undefined) outer.flexShrink = flexShrink;
    if (flexBasis !== undefined) outer.flexBasis = flexBasis;
    if (alignSelf !== undefined) outer.alignSelf = alignSelf;
    if (width !== undefined) outer.width = width;
    // The inner box fills whatever the outer one was given.
    const inner: ViewStyle =
      flex !== undefined || width !== undefined ? { ...rest, width: '100%' } : rest;
    return [outer, inner];
  }, [style]);

  const pressIn = () => {
    hapticLight();
    Animated.spring(scale, {
      toValue: pressedScale,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 8,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={hitSlop ?? 8}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      style={outerStyle}
    >
      <Animated.View
        style={[innerStyle, { transform: [{ scale }] }, disabled && { opacity: 0.5 }]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};
