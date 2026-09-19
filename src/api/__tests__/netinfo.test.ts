import { __testables } from '../offlineQueue';

describe('network reachability fallback', () => {
  const reachable = __testables.isReachable;

  it('treats null as reachable (unknown, not offline)', () => {
    expect(reachable(null)).toBe(true);
  });

  it('treats undefined as reachable (older NetInfo shape)', () => {
    expect(reachable(undefined)).toBe(true);
  });

  it('treats true as reachable', () => {
    expect(reachable(true)).toBe(true);
  });

  it('treats only a real false as unreachable', () => {
    expect(reachable(false)).toBe(false);
  });

  it('isOnline: null reachability on a connected network stays online', () => {
    expect(
      __testables.isOnline({ isConnected: true, isInternetReachable: null } as never)
    ).toBe(true);
  });

  it('isOnline: connected and confirmed unreachable is offline', () => {
    expect(
      __testables.isOnline({ isConnected: true, isInternetReachable: false } as never)
    ).toBe(false);
  });

  it('isOnline: disconnected is offline regardless of the probe', () => {
    expect(
      __testables.isOnline({ isConnected: false, isInternetReachable: true } as never)
    ).toBe(false);
  });
});
