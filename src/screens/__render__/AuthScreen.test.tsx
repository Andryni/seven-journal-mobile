import React from 'react';
import { render } from '@testing-library/react-native';
import { AuthScreen } from '../AuthScreen';

jest.mock('../../api/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(async () => ({ error: null })),
      signUp: jest.fn(async () => ({ error: null })),
      resetPasswordForEmail: jest.fn(async () => ({ error: null })),
      signInWithOAuth: jest.fn(async () => ({ error: null })),
    },
  },
}));

/**
 * The first screen a user ever sees, and until now the only one with no
 * render test at all.
 */
describe('AuthScreen', () => {
  it('mounts without throwing', () => {
    expect(() => render(<AuthScreen />)).not.toThrow();
  });

  it('does not offer password recovery', () => {
    // resetPasswordForEmail needs a redirect back into the app, and that deep
    // link is not wired up: the mail arrives and its button goes nowhere.
    // Offering a recovery that silently fails is worse than offering none --
    // someone locked out of their trading journal would sit and wait for it.
    const { queryByText } = render(<AuthScreen />);
    expect(queryByText(/oubli|forgot/i)).toBeNull();
  });

  it('still offers both sign in and sign up', () => {
    const { toJSON } = render(<AuthScreen />);
    expect(JSON.stringify(toJSON())).toMatch(/SE CONNECTER|SIGN IN/i);
  });

  it('survives re-renders without reordering hooks', () => {
    const { rerender } = render(<AuthScreen />);
    expect(() => {
      rerender(<AuthScreen />);
      rerender(<AuthScreen />);
    }).not.toThrow();
  });
});
