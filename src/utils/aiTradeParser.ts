export interface ParsedTradeAI {
  pair: string;
  direction: 'BUY' | 'SELL';
  size: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  exit_price?: number | null;
  pnl?: number | null;
  result?: 'TP' | 'SL' | 'BE' | 'OPEN';
  timeframe?: 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';
}

export async function parseTradeScreenshotAI(
  base64Image: string,
  apiKey?: string
): Promise<ParsedTradeAI | null> {
  const geminiKey = apiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!geminiKey) {
    console.warn('EXPO_PUBLIC_GEMINI_API_KEY manquant dans .env ou eas.json.');
    throw new Error('API_KEY_MISSING');
  }

  try {
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

    const prompt = `Tu es un expert en trading quantitatif. Analyse cette capture d'ecran d'application de trading (MetaTrader 4, MetaTrader 5 / MT5, cTrader, TradingView, ou broker).
Extrais précisément les informations de la position visible (symbole/paire, direction BUY ou SELL, volume/lot, prix d'ouverture/entrée, Stop Loss, Take Profit, prix de clôture/sortie, P&L / profit réalisé).

Exemple pour MT5 (ex: "BTCUSD.s, buy 4.40" avec prix "77 257.00 -> 77 130.93" et profit "-554.71") :
- pair: "BTCUSD" (sans suffixe de courtier comme .s ou .m)
- direction: "BUY"
- size: 4.40
- entry_price: 77257.00
- exit_price: 77130.93
- pnl: -554.71
- result: "SL" (ou "TP" si profit positif)
- stop_loss: 77130.93 (ou déduis selon S/L)
- take_profit: 77808.58 (ou déduis selon T/P)

Réponds STRICTEMENT avec un objet JSON pur sans balises markdown :
{
  "pair": "BTCUSD",
  "direction": "BUY",
  "size": 4.4,
  "entry_price": 77257.00,
  "stop_loss": 77130.93,
  "take_profit": 77808.58,
  "exit_price": 77130.93,
  "pnl": -554.71,
  "result": "SL",
  "timeframe": "M5"
}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Erreur API Gemini Vision:', err);
      return null;
    }

    const data = await response.json();
    let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    // Remove markdown code fences if present (```json ... ```)
    rawText = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

    const parsed: ParsedTradeAI = JSON.parse(rawText);
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message === 'API_KEY_MISSING') {
      throw error;
    }
    console.error('Erreur parseTradeScreenshotAI:', error);
    return null;
  }
}
