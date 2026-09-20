import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuickTradeSheet } from '../QuickTradeSheet';

/**
 * The quick entry is a SHORT sheet, and that is a product rule, not a taste.
 *
 * It was rendering as a full-screen page (flex: 1) after the gesture
 * bottom-sheet was dropped: six fields at the top, then a screenful of empty
 * space, with the save button alone at the bottom. The trader read it as a
 * form they had failed to fill. What has to hold is that the card takes its
 * height from its CONTENT — a ceiling, and a body that shrinks rather than a
 * body that stretches.
 */

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * The sheet reads accounts, trades and the daily lock, so its queries land a
 * tick after mount. Flushing them inside act() keeps the suite free of the
 * "update not wrapped in act" warning -- which, left in, hides the next real
 * one.
 */
async function renderSheet() {
  const utils = render(
    <Wrapper>
      <QuickTradeSheet visible onClose={jest.fn()} />
    </Wrapper>
  );
  await act(async () => {
    // Two macrotasks: react-query notifies on a timer, and its listeners
    // settle one turn after the promise that carried the data.
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return utils;
}

describe('QuickTradeSheet — geometry', () => {
  it('renders the form and its footer', async () => {
    const { getByText } = await renderSheet();
    expect(getByText(/SAISIE RAPIDE|QUICK ENTRY/)).toBeTruthy();
    expect(getByText(/Compléter plus tard|Complete later/)).toBeTruthy();
  });

  it('keeps every field of the form inside the sheet', async () => {
    const { getByText } = await renderSheet();
    // The six things a live entry cannot be reconstructed without.
    expect(getByText(/INSTRUMENT/)).toBeTruthy();
    expect(getByText(/ENTRÉE|ENTRY/)).toBeTruthy();
    expect(getByText('SL')).toBeTruthy();
    expect(getByText('TP')).toBeTruthy();
    expect(getByText(/RISQUE %|RISK %/)).toBeTruthy();
    expect(getByText(/CONTRÔLE PRÉ-TRADE|PRE-TRADE CHECK/)).toBeTruthy();
  });

  it('sizes the card to its content instead of the whole screen', async () => {
    // flex: 1 here is the regression: it turns a six-field form into a page
    // with a screenful of dead space under it, which is what the trader saw.
    const { getByTestId } = await renderSheet();
    const card = StyleSheet.flatten(getByTestId('quick-entry-card').props.style);
    expect(card).toEqual(expect.objectContaining({ maxHeight: '92%' }));
    expect(card).not.toHaveProperty('flex');
    expect(card).not.toHaveProperty('flexGrow');
  });

  it('lets the body shrink when the content is tall, never grow', async () => {
    // flexShrink with no flexGrow: the ScrollView takes its content's height
    // until the card hits its ceiling -- a short entry stays a short sheet.
    const { getByTestId } = await renderSheet();
    const body = StyleSheet.flatten(getByTestId('quick-entry-body').props.style);
    expect(body).toEqual(expect.objectContaining({ flexGrow: 0, flexShrink: 1 }));
  });
});
