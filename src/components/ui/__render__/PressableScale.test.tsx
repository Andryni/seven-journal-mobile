import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { PressableScale } from '../PressableScale';

/**
 * Layout props have to land on the outer Pressable.
 *
 * They used to be applied only to the inner Animated.View, so `flex: 1` sized
 * the inner box while the Pressable stayed wrapped around its content. Two
 * such buttons in a row hugged their labels instead of splitting the row --
 * the share sheet's Save / Export pair looked off-centre because of it.
 */
describe('PressableScale layout', () => {
  it('puts flex on the pressable, not only on the inner view', () => {
    const { getByRole } = render(
      <PressableScale style={{ flex: 1, paddingVertical: 13 }} accessibilityLabel="a">
        <Text>A</Text>
      </PressableScale>
    );
    const outer = StyleSheet.flatten(getByRole('button').props.style);
    expect(outer.flex).toBe(1);
  });

  it('keeps painting styles off the outer element', () => {
    const { getByRole } = render(
      <PressableScale
        style={{ flex: 1, backgroundColor: 'red', borderRadius: 10 }}
        accessibilityLabel="a"
      >
        <Text>A</Text>
      </PressableScale>
    );
    const outer = StyleSheet.flatten(getByRole('button').props.style);
    // Background stays inside so the scale animation still transforms it.
    expect(outer.backgroundColor).toBeUndefined();
    expect(outer.borderRadius).toBeUndefined();
  });

  it('forwards alignSelf and width, which are also layout', () => {
    const { getByRole } = render(
      <PressableScale style={{ alignSelf: 'center', width: 120 }} accessibilityLabel="a">
        <Text>A</Text>
      </PressableScale>
    );
    const outer = StyleSheet.flatten(getByRole('button').props.style);
    expect(outer.alignSelf).toBe('center');
    expect(outer.width).toBe(120);
  });

  it('leaves the outer element unstyled when no layout prop is given', () => {
    const { getByRole } = render(
      <PressableScale style={{ padding: 8 }} accessibilityLabel="a">
        <Text>A</Text>
      </PressableScale>
    );
    const outer = StyleSheet.flatten(getByRole('button').props.style) ?? {};
    expect(outer.padding).toBeUndefined();
  });

  it('mounts with no style at all', () => {
    expect(() =>
      render(
        <PressableScale accessibilityLabel="a">
          <Text>A</Text>
        </PressableScale>
      )
    ).not.toThrow();
  });
});
