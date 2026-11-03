# Fiber Tools

Toolkit per tecnici FTTH: codici colore fibra ottica, PFS, PTE, FiberCop, ribattitura ottici e generatore di codici a barre Code 128.
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
| 05 | **Ribattitura ottici** | 16 ottici per splitter, archivio per cartelle PFS, sincronizzazione Google Sheets, scanner, ricerca per ID, PDF/Excel, condivisione |
| 06 | **Generatore barcode** | Code 128 leggibile da scanner, schermo intero, PNG, scansione di codici esistenti |

### Ribattitura: funzioni principali
- **Scanner con fotocamera**: il pulsante accanto a ogni ID legge l'etichetta. Con *Passa all'ottico successivo* puoi scansionare gli ottici uno dopo l'altro senza chiudere la fotocamera. Se la fotocamera non è disponibile si può usare *Da foto*.
- **Nome tecnico**: chiesto al primo salvataggio, compare su ogni ribattitura (modificabile dall'icona ⚙️).
- **Ricerca**: nel campo dell'archivio puoi cercare PFS, splitter, **ID** o **permuta**; per gli ID trovati vedi PFS, splitter e ottico, e un tocco apre la ribattitura sulla riga giusta.
- **Esportazione**: PDF (stampa → *Salva come PDF*) ed Excel (.csv) per un singolo splitter o per l'intera cartella PFS.
- **Condividi**: invio del testo su WhatsApp, email, ecc.
- **Maiuscole automatiche** su tutti i campi.

## Installare l'app sul telefono
- **Android (Chrome)**: apri il link e tocca **Installa** nel riquadro della home (oppure menu ⋮ → *Installa app*).
- **iPhone (Safari)**: apri il link, tocca **Condividi** → **Aggiungi alla schermata Home**.

Dopo il primo avvio l'app funziona anche offline (la sincronizzazione con Google Sheets riparte quando torna la rete).

## Script Google Sheets v2

L'app funziona con lo script attuale. Installando lo **script v2** si sincronizzano anche il **nome del tecnico** e le **eliminazioni** (con lo script vecchio una ribattitura eliminata ricompare al successivo *Aggiorna*).

1. Apri il foglio Google collegato all'app → **Estensioni → Apps Script**.
2. Sostituisci il contenuto di `Code.gs` con quello di [`apps-script/Code.gs`](apps-script/Code.gs) e salva.
3. **Esegui il deployment → Gestisci deployment** → modifica (✏️) il deployment esistente → *Versione*: **Nuova versione** → **Esegui il deployment**.
   Modificando il deployment esistente l'indirizzo resta lo stesso e l'app non va toccata. Accesso: **Chiunque**.
4. I dati vengono scritti nel foglio **Ribattiture** (creato in automatico, una riga per PFS + splitter).
5. Nell'app: ⚙️ **Impostazioni** → dopo un *Aggiorna da Google Sheets* compare *Script v2 attivo*. Con **Invia tutto l'archivio a Sheets** copi nel nuovo foglio le ribattiture già presenti sul telefono.

## Struttura del progetto

```
index.html              app completa (HTML, CSS, JavaScript)
manifest.webmanifest    installazione come app
sw.js                   funzionamento offline
icons/                  icone dell'app
vendor/                 lettore codici a barre (zxing, per iPhone e browser senza lettore integrato)
apps-script/Code.gs     script Google Sheets v2
```

Quando modifichi i file, aumenta `VERSION` in `sw.js` così i telefoni scaricano la versione nuova.

## Note sulla sicurezza
- L'indirizzo dello script Google è nel codice della pagina: chiunque abbia il link può leggere l'archivio e inviare ribattiture.
- Il login amministratore è verificato nel browser (nel codice c'è solo l'impronta SHA-256 delle credenziali): scoraggia gli utenti normali ma non è una protezione forte.

## Crediti
Lettura codici a barre: [barcode-detector](https://github.com/Sec-ant/barcode-detector) e [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (MIT), basati su [ZXing-C++](https://github.com/zxing-cpp/zxing-cpp) (Apache 2.0).
