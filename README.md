# Fiber Tools

Toolkit per tecnici FTTH: codici colore fibra ottica, PFS, PTE, FiberCop, ribattitura ottici, posizioni dei PFS, budget ottico e generatore di codici a barre Code 128.
Funziona da telefono, si installa come app e lavora anche senza connessione.

**Apri l'app:** https://napoltano.github.io/fiber-tools/

Creato e realizzato da **Marigliano Massimiliano**.

## Strumenti

| # | Strumento | Cosa fa |
|---|-----------|---------|
| 01 | **PFS** | Da numero permuta a cartolina e colore, e viceversa (Open Fiber, Enel, Bull/Infratel, cartoline da 12 o 24) |
| 02 | **PTE** | Selezioni le fibre libere del tubetto e ti dice quale usare per priorità |
| 03 | **Calculator** | Colore, tubetto e posizione di qualsiasi fibra, con tabella completa |
| 04 | **FiberCop** | Conversione quartina ↔ cartolina ↔ numero fibra |
| 05 | **Ribattitura ottici** | 16 ottici per splitter, archivio per cartelle PFS condiviso su Google Sheets, scanner, ricerca per ID, controlli duplicati, foto, storico, PDF/Excel |
| 06 | **Generatore barcode** | Code 128 leggibile da scanner, schermo intero, PNG, scansione di codici esistenti |
| 07 | **PFS Qui** | Coordinate dei PFS divise per anello (NA_01, NA_02…), ricerca, "vicino a me", mappa e navigazione con Google Maps |
| 08 | **Budget ottico** | Attenuazione prevista della tratta e verifica della potenza letta col power meter |

### Ribattitura
- **Scanner con fotocamera**: il pulsante accanto a ogni ID legge l'etichetta. Con *Passa all'ottico successivo* scansioni gli ottici uno dopo l'altro. Senza fotocamera si può usare *Da foto*.
- **Controlli duplicati**: avviso se lo stesso ID compare in due ottici, se una permuta è ripetuta, o se l'ID è già usato in un altro splitter dell'archivio.
- **Riepilogo cartella**: per ogni PFS quanti ottici hanno l'ID, quanti sono NO IDR e quanti vuoti.
- **Foto dello splitter**, salvata su Google Drive.
- **Storico**: chi ha modificato cosa e quando (con lo script v3).
- **Ricerca** per PFS, splitter, ID o permuta; **PDF / Excel** per splitter o cartella intera; **Condividi** su WhatsApp.
- Dalla cartella PFS: **📍 Naviga** se il PFS ha una posizione salvata, altrimenti **📍 Posizione** per salvarla.

### PFS Qui
- **Aggiungi PFS**: codice (l'anello viene riconosciuto in automatico, es. `NA_05/08W22` → anello `NA_05`), coordinate con **Posizione attuale** (GPS) oppure incollando coordinate o un link di Google Maps, note di accesso e foto.
- **Importa da Google My Maps**: incolli il link della mappa con i PFS e l'app scarica tutti i punti (anche migliaia), li divide per anello e li invia al foglio a blocchi. Ripetendo l'importazione si aggiornano le posizioni cambiate; quelle corrette a mano restano com'erano (salvo *Sostituisci anche le posizioni inserite a mano*). Si può usare anche un file KML/KMZ esportato da My Maps, oppure un link rapido `…/fiber-tools/#importa=<link della mappa>`.
- **Condividi posizioni**: crea un file (KML) con tutti i PFS, un anello, i risultati di una ricerca o solo quelli aggiunti/corretti a mano, e lo invia su WhatsApp, email ecc. (dove il telefono non permette di inviare .kml viene inviato come .txt, che si importa allo stesso modo). Anche un singolo PFS si può inviare come file.
- **Importa posizioni da file**: il collega carica il file ricevuto in *PFS Qui → Importa posizioni → Scegli il file*, **anche offline**. Vince la posizione più recente: le correzioni fatte a mano più nuove sul suo telefono restano. Il file si apre anche in Google Earth / My Maps.
- **Elenco per anello** con ricerca per PFS, anello o note (`NA_01 16e13` e `NA_01/16E13` sono lo stesso PFS); **Vicino a me** ordina i PFS per distanza.
- **Mappa** con un colore per ogni anello; **Naviga** apre Google Maps con il percorso fino al PFS.
- **Elimina** solo per l'amministratore (anche lo script lo verifica, se è impostata `ADMIN_KEY`).

### Sempre attivi
- **Coda offline**: se manca la rete, salvataggi ed eliminazioni restano in coda (barra arancione in alto) e partono da soli quando torna la connessione.
- **Backup**: ⚙️ Impostazioni → *Scarica* / *Ripristina*, utile per cambiare telefono.
- **Avviso aggiornamento** quando viene pubblicata una nuova versione.
- **Maiuscole automatiche** su tutti i campi.

## Installare l'app sul telefono
- **Android (Chrome)**: apri il link e tocca **Installa** nel riquadro della home (oppure menu ⋮ → *Installa app*).
- **iPhone (Safari)**: apri il link, tocca **Condividi** → **Aggiungi alla schermata Home**.

## Script Google Sheets v3

L'app funziona anche con gli script precedenti, ma **posizioni PFS, foto, storico, protezione con codice squadra ed eliminazioni** si sincronizzano solo con lo script v3.

1. Apri il foglio Google collegato all'app → **Estensioni → Apps Script**.
2. Sostituisci il contenuto di `Code.gs` con quello di [`apps-script/Code.gs`](apps-script/Code.gs) e salva.
3. **Proteggi il foglio** (consigliato, perché l'indirizzo dello script è pubblico): ⚙️ **Impostazioni progetto → Proprietà script → Aggiungi proprietà**
   - `TEAM_KEY` = un codice squadra a tua scelta (es. `FTTH-NA-7x92`), da dare ai colleghi
   - `ADMIN_KEY` = la tua password admin dell'app: solo chi la conosce può eliminare
4. **Esegui il deployment → Gestisci deployment** → modifica (✏️) il deployment esistente → *Versione*: **Nuova versione** → **Esegui il deployment**.
   Modificando il deployment esistente l'indirizzo resta lo stesso e l'app non va toccata. Accesso: **Chiunque**.
   La prima volta Google chiede di **autorizzare** l'accesso a Fogli e Drive (Drive serve per le foto): conferma con il tuo account.
5. Ogni tecnico, nell'app: ⚙️ **Impostazioni → Codice squadra** → inserisce il `TEAM_KEY`.
6. Con **Invia tutto l'archivio a Sheets** copi nei nuovi fogli quello che c'è già sul telefono.

Fogli creati in automatico: **Ribattiture** (una riga per PFS + splitter), **PFS_Posizioni** (una riga per PFS, con link alla mappa), **Storico** (ogni modifica). Le foto vanno nella cartella Drive **Fiber Tools Foto**.

## Struttura del progetto

```
index.html              app completa (HTML, CSS, JavaScript)
manifest.webmanifest    installazione come app
sw.js                   funzionamento offline
icons/                  icone dell'app
vendor/                 lettore codici a barre (zxing) e mappa (Leaflet)
apps-script/Code.gs     script Google Sheets v3
```

Quando modifichi i file, aumenta `VERSION` in `sw.js` così i telefoni scaricano la versione nuova.

## Note sulla sicurezza
- Senza `TEAM_KEY` chiunque trovi l'indirizzo dello script (visibile nel codice) può leggere l'archivio e scriverci. Con `TEAM_KEY` serve il codice squadra.
- Il login amministratore dell'app è verificato nel browser; le eliminazioni sono però verificate anche dallo script se è impostata `ADMIN_KEY`.
- Le foto su Drive sono visibili a chi ha il link della singola foto.

## Crediti
Lettura codici a barre: [barcode-detector](https://github.com/Sec-ant/barcode-detector) e [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (MIT), basati su [ZXing-C++](https://github.com/zxing-cpp/zxing-cpp) (Apache 2.0).
Mappa: [Leaflet](https://leafletjs.com) (BSD-2) con dati © [OpenStreetMap](https://www.openstreetmap.org/copyright).
