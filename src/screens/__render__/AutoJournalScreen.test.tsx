import { AutoJournalScreen } from '../AutoJournalScreen';
import { renderScreen } from '../../test-utils/renderScreen';

/**
 * The auto-journal screen. The interesting assertions are not "it mounts":
 * the section verbs must be present (promote/link/dismiss machine), and the
 * screen must stay stable across re-renders while its queries resolve.
 */

jest.mock('../../api/supabaseClient', () => {
  /**
   * Universal chainable thenable: any .from().select().eq().order().limit()
   * shape resolves to an empty page. The queue hook builds several different
   * query chains; the mock mirrors the promise API rather than each chain.
   */
  const chain = (): unknown => {
    const p = Promise.resolve({ data: [], error: null });
    const proxy = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return p.then.bind(p);
        if (prop === 'catch') return p.catch.bind(p);
        return () => proxy;
      },
    });
    return proxy;
  };
  return {
    supabase: {
      auth: {
        getUser: jest.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
      },
      from: jest.fn(() => chain()),
      rpc: jest.fn(async () => ({ data: 0, error: null })),
    },
  };
});

describe('AutoJournalScreen', () => {
  it('mounts without throwing on an empty queue', () => {
    const { toJSON } = renderScreen(<AutoJournalScreen />);
    expect(toJSON()).not.toBeNull();
  });

  it('renders the connectors and queue section headers', async () => {
    const { findByText } = renderScreen(<AutoJournalScreen />);
    // Either language; the headers are uppercase micro-labels.
    await findByText(/CONNECTEURS|CONNECTORS/);
    await findByText(/FILE DE VALIDATION|VALIDATION QUEUE/);
  });

  it('survives remounting without reordering hooks', () => {
    // rerender() replaces the element without its providers, so a remount is
    // the honest way to exercise the hook chain twice here.
    expect(() => {
      renderScreen(<AutoJournalScreen />);
      renderScreen(<AutoJournalScreen />);
    }).not.toThrow();
  });
});
