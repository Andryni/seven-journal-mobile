//+------------------------------------------------------------------+
//|                                            SevenJournalSync.mq5  |
//|  Pont MT5 -> Seven Journal.                                      |
//|                                                                  |
//|  Pousse chaque position (ouverte puis fermee) vers le webhook    |
//|  /sync-ingest. ECRITURE SEULE : le secret ne permet jamais de    |
//|  lire quoi que ce soit. Le serveur dedupe par position id : un   |
//|  renvoi est donc toujours inoffensif.                            |
//|                                                                  |
//|  Une ligne JSON PAR POSITION :                                   |
//|   - entrees sommees (taille, prix moyen pondere, heure la plus   |
//|     ancienne), sorties listees individuellement,                 |
//|   - pnl NET = somme(profit) - somme(commission) - somme(swap).   |
//|                                                                  |
//|  Installation : voir bridge/mt5/README.md                        |
//+------------------------------------------------------------------+
#property copyright "Seven Journal"
#property link      "https://seven-journal.app"
#property version   "1.00"
#property strict

//--- Parametres (a renseigner apres creation du connecteur dans l'app)
input string InpWebhookUrl     = "";    // URL du webhook (.../functions/v1/sync-ingest)
input string InpSecret         = "";    // Secret du connecteur (write-only)
input int    InpScanSeconds    = 15;    // Frequence de scan de l'historique (s)
input int    InpBeatSeconds    = 60;    // Frequence du heartbeat (s)
input int    InpTimeoutMs      = 10000; // Timeout WebRequest (ms)
input int    InpOverlapMinutes = 120;   // Recouvrement du scan (sécurité anti-trou)

//--- Etat
datetime g_lastScanFrom   = 0;     // watermark : on scanne l'historique a partir de la
datetime g_lastScanAt     = 0;     // planification : dernier scan effectue
datetime g_lastBeatAt     = 0;
int      g_timer          = 5;     // tick d'horloge interne (s)

//+------------------------------------------------------------------+
//| Init : validation des entrees + horloge                          |
//+------------------------------------------------------------------+
int OnInit()
  {
   if(StringLen(InpWebhookUrl) == 0 || StringLen(InpSecret) == 0)
     {
      Print("SevenJournalSync: renseignez l'URL du webhook et le secret du connecteur");
      return(INIT_PARAMETERS_INCORRECT);
     }
   if(StringFind(InpWebhookUrl, "https://") != 0)
     {
      Print("SevenJournalSync: l'URL doit etre en HTTPS");
      return(INIT_PARAMETERS_INCORRECT);
     }

   // Reprise apres redemarrage : on repart d'au moins une heure en arriere.
   datetime saved = (datetime)GlobalVariableGet("SevenJournalSync_watermark");
   g_lastScanFrom = (saved > 0) ? saved - InpOverlapMinutes * 60 : TimeCurrent() - 86400;

   EventSetTimer(g_timer);
   Print("SevenJournalSync: actif. Premier scan depuis ", TimeToString(g_lastScanFrom));
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Deinit                                                           |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

//+------------------------------------------------------------------+
//| Horloge : scan + heartbeat selon leurs frequences respectives    |
//+------------------------------------------------------------------+
void OnTimer()
  {
   datetime now = TimeCurrent();

   if(now - g_lastBeatAt >= InpBeatSeconds)
     {
      g_lastBeatAt = now;
      SendHeartbeat();
     }

   if(now - g_lastScanAt >= InpScanSeconds)
     {
      g_lastScanAt = now;
      ScanAndPush();
     }
  }

//+------------------------------------------------------------------+
//| POST JSON vers le webhook. Retourne true si 2xx.                 |
//| Retry x3 avec backoff pour les erreurs reseau transitoires.      |
//+------------------------------------------------------------------+
bool PostJson(const string body, string &responseCode)
  {
   char data[];
   char result[];
   string headers = "Authorization: Bearer " + InpSecret + "\r\n" +
                    "Content-Type: application/json\r\n";
   string resultHeaders;

   StringToCharArray(body, data, 0, StringLen(body), CP_UTF8);

   for(int attempt = 0; attempt < 3; attempt++)
     {
      ResetLastError();
      int status = WebRequest("POST", InpWebhookUrl, headers, InpTimeoutMs,
                              data, result, resultHeaders);

      if(status == -1)
        {
         int err = GetLastError();
         if(err == 4014)
           {
            Print("SevenJournalSync: URL non autorisee. Options -> Expert Advisors ->",
                  " Autoriser WebRequest pour : ", InpWebhookUrl);
            responseCode = "url_not_allowed";
            return(false);   // inutile de ressayer : c'est une config, pas un reseau
           }
         Print("SevenJournalSync: erreur reseau ", err, " (essai ", attempt + 1, "/3)");
        }
      else if(status >= 200 && status < 300)
        {
         responseCode = IntegerToString(status);
         GlobalVariableSet("SevenJournalSync_watermark", (double)g_lastScanFrom);
         return(true);
        }
      else
        {
         responseCode = IntegerToString(status);
         Print("SevenJournalSync: HTTP ", status, " -> ", CharArrayToString(result));
         // 4xx (sauf 429) : renvoyer ne changera rien, on abandonne.
         if(status >= 400 && status < 500 && status != 429)
           {
            GlobalVariableSet("SevenJournalSync_watermark", (double)g_lastScanFrom);
            return(false);
           }
        }

      Sleep(1000 * (attempt + 1));   // backoff lineaire 1s, 2s
     }

   return(false);
  }

//+------------------------------------------------------------------+
//| Heartbeat : la liste des positions actuellement ouvertes.        |
//| Aucune donnee de trade : juste les ids, pour le statut du        |
//| connecteur et la retraite des lignes disparues (stale).          |
//+------------------------------------------------------------------+
void SendHeartbeat()
  {
   string ids = "";
   for(int i = 0; i < PositionsTotal(); i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(ids != "") ids += ",";
      ids += "\"" + IntegerToString((long)PositionGetInteger(POSITION_IDENTIFIER)) + "\"";
     }

   string body = "{\"type\":\"heartbeat\",\"open_ids\":[" + ids + "]}";
   string code;
   PostJson(body, code);
  }

//+------------------------------------------------------------------+
//| Scan de l'historique : agregation par position id.               |
//+------------------------------------------------------------------+
void ScanAndPush()
  {
   datetime from = g_lastScanFrom - InpOverlapMinutes * 60;
   datetime to   = TimeCurrent() + 60;

   if(!HistorySelect(from, to)) return;

   //--- 1re passe : collecter les ids de positions fermees (deal OUT) dans
   //    un tableau. BuildPositionEvent re-selectionne l'historique via
   //    HistorySelectByPosition : on ne peut PAS iterer les deals et
   //    construire les positions en meme temps. On collecte les ids d'abord,
   //    puis on construit position par position en passe 2.
   string closedArr[];
   int    closedN = 0;
   ArrayResize(closedArr, 0, 256);

   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0) continue;

      long entry = HistoryDealGetInteger(deal, DEAL_ENTRY);
      long posId = HistoryDealGetInteger(deal, DEAL_POSITION_ID);
      if(posId == 0) continue;

      if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY || entry == DEAL_ENTRY_INOUT)
        {
         string id = IntegerToString(posId);
         bool known = false;
         for(int k = 0; k < closedN; k++)
            if(closedArr[k] == id) { known = true; break; }
         if(!known)
           {
            ArrayResize(closedArr, closedN + 1);
            closedArr[closedN] = id;
            closedN++;
           }
        }
     }

   //--- 2e passe : construire et envoyer chaque position fermee (par id)
   string events = "";
   int    count  = 0;

   for(int c = 0; c < closedN && count < 200; c++)
     {
      string id = closedArr[c];
      if(StringFind(events, "\"external_id\":\"" + id + "\"") >= 0) continue; // deja agregee

      string ev = BuildPositionEvent(id, false);
      if(ev == "") continue;

      if(events != "") events += ",";
      events += ev;
      count++;
     }

   //--- 3e passe : les positions ouvertes (etat courant du terminal)
   for(int p = 0; p < PositionsTotal() && count < 200; p++)
     {
      ulong ticket = PositionGetTicket(p);
      if(ticket == 0) continue;

      string id = IntegerToString((long)PositionGetInteger(POSITION_IDENTIFIER));
      if(StringFind(events, "\"external_id\":\"" + id + "\"") >= 0) continue;

      // PositionGetTicket a selectionne la position : on lit SL/TP ICI,
      // car BuildPositionEvent bascule le contexte sur l'historique.
      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);

      string ev = BuildPositionEvent(id, true, sl, tp);
      if(ev == "") continue;

      if(events != "") events += ",";
      events += ev;
      count++;
     }

   if(count == 0)
     {
      g_lastScanFrom = to;
      GlobalVariableSet("SevenJournalSync_watermark", (double)g_lastScanFrom);
      return;
     }

   string body = "{\"type\":\"trades\",\"events\":[" + events + "]}";
   string code;
   if(PostJson(body, code))
     {
      Print("SevenJournalSync: ", count, " position(s) envoyee(s) (HTTP ", code, ")");
      g_lastScanFrom = to;
      GlobalVariableSet("SevenJournalSync_watermark", (double)g_lastScanFrom);
     }
  }

//+------------------------------------------------------------------+
//| Construit le JSON d'UNE position (fermee ou ouverte).             |
//| Entrees sommees, sorties listees, pnl NET.                        |
//+------------------------------------------------------------------+
string BuildPositionEvent(const string posId, const bool isOpen,
                          const double curSL = 0, const double curTP = 0)
  {
   long   posIdNum = StringToInteger(posId);
   if(!HistorySelectByPosition(posIdNum)) return("");

   string symbol       = "";
   string direction    = "BUY";
   double inVol        = 0, inVolPrice = 0;
   double outVol       = 0, outVolPrice = 0;
   double profitSum    = 0, commSum = 0, swapSum = 0;
   datetime inTime     = 0, lastOutTime = 0;
   long     lastReason = -1;
   string exits        = "";
   int    exitsCount   = 0;

   int deals = HistoryDealsTotal();
   for(int i = 0; i < deals; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0) continue;

      long   dType  = HistoryDealGetInteger(deal, DEAL_TYPE);
      long   dEntry = HistoryDealGetInteger(deal, DEAL_ENTRY);
      double dVol   = HistoryDealGetDouble(deal, DEAL_VOLUME);
      double dPrice = HistoryDealGetDouble(deal, DEAL_PRICE);
      datetime dTime = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);

      if(symbol == "") symbol = HistoryDealGetString(deal, DEAL_SYMBOL);

      // Les frais portent sur TOUS les deals (entree comme sortie).
      profitSum += HistoryDealGetDouble(deal, DEAL_PROFIT);
      commSum   += MathAbs(HistoryDealGetDouble(deal, DEAL_COMMISSION));
      swapSum   += HistoryDealGetDouble(deal, DEAL_SWAP);

      if(dEntry == DEAL_ENTRY_IN)
        {
         if(inTime == 0 || dTime < inTime) inTime = dTime;
         inVol      += dVol;
         inVolPrice += dPrice * dVol;
         if(dType == DEAL_TYPE_SELL) direction = "SELL";
        }
      else if(dEntry == DEAL_ENTRY_OUT || dEntry == DEAL_ENTRY_OUT_BY || dEntry == DEAL_ENTRY_INOUT)
        {
         outVol      += dVol;
         outVolPrice += dPrice * dVol;
         lastOutTime  = dTime;
         lastReason   = HistoryDealGetInteger(deal, DEAL_REASON);

         double dPnl = HistoryDealGetDouble(deal, DEAL_PROFIT)
                     - MathAbs(HistoryDealGetDouble(deal, DEAL_COMMISSION))
                     - MathAbs(HistoryDealGetDouble(deal, DEAL_SWAP));
         if(exits != "") exits += ",";
         exits += "{\"size\":" + Num(dVol, 2) +
                  ",\"price\":" + Num(dPrice, 8) +
                  ",\"exit_time\":\"" + IsoTime(dTime) + "\"" +
                  ",\"pnl\":" + Num(dPnl, 2) + "}";
         exitsCount++;
        }
     }

   if(inVol <= 0) return("");

   double entryPrice = inVolPrice / inVol;
   double pnl        = profitSum - commSum - swapSum;

   string json = "{\"external_id\":\"" + posId + "\"" +
                 ",\"symbol\":\"" + JsonEscape(symbol) + "\"" +
                 ",\"direction\":\"" + direction + "\"" +
                 ",\"size\":" + Num(inVol, 2) +
                 ",\"entry_price\":" + Num(entryPrice, 8) +
                 ",\"entry_time\":\"" + IsoTime(inTime) + "\"" +
                 ",\"is_open\":" + (isOpen ? "true" : "false");

   if(isOpen)
     {
      // SL/TP courants de la position vivante, lus par l'appelant.
      if(curSL > 0) json += ",\"stop_loss\":" + Num(curSL, 8);
      if(curTP > 0) json += ",\"take_profit\":" + Num(curTP, 8);
     }
   else
     {
      if(outVol > 0)
         json += ",\"exit_price\":" + Num(outVolPrice / outVol, 8);
      json += ",\"close_time\":\"" + IsoTime(lastOutTime) + "\"";
      json += ",\"pnl\":" + Num(pnl, 2);
      json += ",\"commission\":" + Num(commSum, 2);
      json += ",\"swap\":" + Num(swapSum, 2);
      json += ",\"close_reason\":\"" + CloseReason(lastReason, pnl) + "\"";
      if(exitsCount > 1)   // une seule sortie = pas de detail partiel utile
         json += ",\"exits\":[" + exits + "]";
     }

   json += "}";
   return(json);
  }

//+------------------------------------------------------------------+
//| Raison de cloture : raison du DERNIER deal OUT, avec repli BE.   |
//+------------------------------------------------------------------+
string CloseReason(const long lastReason, const double pnl)
  {
   if(lastReason == DEAL_REASON_TP) return("TP");
   if(lastReason == DEAL_REASON_SL) return("SL");
   if(MathAbs(pnl) < 0.01)          return("BE");
   return("CLOSED");   // client, expert, mobile, stop-out, ...
  }

//+------------------------------------------------------------------+
//| Utilitaires de formatage                                         |
//+------------------------------------------------------------------+
string Num(const double v, const int digits)
  {
   string s = DoubleToString(v, digits);
   StringReplace(s, ",", ".");
   return(s);
  }

string IsoTime(const datetime t)
  {
   // ISO-8601 UTC : 2026-09-18T09:31:22Z
   // (TimeYear/TimeMonth/... n'existent qu'en MQL4 : on passe par la struct)
   MqlDateTime tm;
   TimeToStruct(t, tm);
   return(StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                       tm.year, tm.mon, tm.day, tm.hour, tm.min, tm.sec));
  }

string JsonEscape(string s)
  {
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   StringReplace(s, "\n", "\\n");
   StringReplace(s, "\r", "\\r");
   StringReplace(s, "\t", "\\t");
   return(s);
  }
//+------------------------------------------------------------------+
