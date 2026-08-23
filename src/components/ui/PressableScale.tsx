import React, { useCallback } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useHaptic } from '../../hooks/useHaptic';

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PressableScale: React.FC<PressableScaleProps> = ({
  children,
  style,
  scaleTo = 0.96,
  haptic = true,
  onPressIn,
  onPressOut,
  onPress,
  ...props
}) => {
  const scale = useSharedValue(1);
  const { light } = useHaptic();

  const handlePressIn = useCallback(
    (e: any) => {
      scale.value = withSpring(scaleTo, { damping: 14, stiffness: 240, mass: 0.8 });
      if (haptic) light();
      onPressIn?.(e);
    },
    [scaleTo, haptic, light, onPressIn]
  );

  const handlePressOut = useCallback(
    (e: any) => {
      scale.value = withSpring(1, { damping: 14, stiffness: 240, mass: 0.8 });
      onPressOut?.(e);
    },
    [onPressOut]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...props}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
};
