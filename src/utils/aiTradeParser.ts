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
    console.warn('Aucune clé GEMINI API configurée.');
    return null;
  }

  try {
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

    const prompt = `Tu es un expert quantitatif. Analyse cette capture d'ecran de trading (MT4, MT5, cTrader, TradingView ou broker).
Extraie les parametres du trade et reponds STRICTEMENT avec un JSON valide respectant ce format :
{
  "pair": "XAUUSD",
  "direction": "BUY",
  "size": 1.0,
  "entry_price": 2380.50,
  "stop_loss": 2375.00,
  "take_profit": 2395.00,
  "exit_price": 2390.00,
  "pnl": 150.00,
  "result": "TP",
  "timeframe": "M5"
}
Si un champ est introuvable, deduis-le ou mets des valeurs coherentes. Ne renvoie rien d'autre que le JSON.`;

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
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsed: ParsedTradeAI = JSON.parse(rawText);
    return parsed;
  } catch (error) {
    console.error('Erreur parseTradeScreenshotAI:', error);
    return null;
  }
}
