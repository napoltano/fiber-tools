# Fiber Tools

Toolkit per tecnici FTTH: codici colore fibra ottica, PFS, PTE, FiberCop, ribattitura ottici, posizioni dei PFS, foto GPS e generatore di codici a barre Code 128.
Funziona da telefono, si installa come app e lavora anche senza connessione.

**Apri l'app:** https://napoltano.github.io/fiber-tools/

Creato e realizzato da **Marigliano Massimiliano**.

## Strumenti

| # | Strumento | Cosa fa |
|---|-----------|---------|
| 01 | **PFS** | Da numero permuta a cartolina e colore, e viceversa (Open Fiber, Enel, Bull/Infratel, TIA-598-C, cartoline da 12 o 24) |
| 02 | **PTE** | Selezioni le fibre libere del tubetto e ti dice quale usare per priorità |
| 03 | **Calculator** | Colore, tubetto e posizione di qualsiasi fibra, con tabella completa (FiberCop/TIM, Open Fiber, Enel, Bull/Infratel, TIA-598-C) |
| 04 | **FiberCop** | Conversione quartina ↔ cartolina ↔ numero fibra |
| 05 | **Ribattitura ottici** | 16 ottici per splitter, archivio per cartelle PFS condiviso su Google Sheets, scanner, ricerca per ID, controlli duplicati, foto, storico, PDF/Excel |
| 06 | **Generatore barcode** | Code 128 leggibile da scanner, schermo intero, PNG, scansione di codici esistenti |
| 07 | **PFS e POP** | Tocca il riquadro: si ingrandisce e scegli **PFS** (coordinate divise per anello) o **POP** (83 centrali Open Fiber). Ricerca, "vicino a me", mappa e navigazione con Google Maps |
| 08 | **Foto GPS** | Foto e video con timbro: via e civico, CAP e città, regione, coordinate GPS, data e ora; salvati nella galleria del telefono |
| 09 | **Schema di Giunzione** | Abbinamento fibra per fibra tra due cavi (N− / N+): tubetto, numero e colore, per TIA-598-C, FiberCop/TIM ST 908, Open Fiber ST 1701 e BUL Infratel |

### Ribattitura
- **Scanner con fotocamera**: il pulsante accanto a ogni ID legge l'etichetta. Con *Passa all'ottico successivo* scansioni gli ottici uno dopo l'altro. Senza fotocamera si può usare *Da foto*.
- **Controlli duplicati**: avviso se lo stesso ID compare in due ottici, se una permuta è ripetuta, o se l'ID è già usato in un altro splitter dell'archivio.
- **Riepilogo cartella**: per ogni PFS quanti ottici hanno l'ID, quanti sono NO IDR e quanti vuoti.
- **Foto dello splitter**, salvata su Google Drive.
- **Storico**: chi ha modificato cosa e quando.
- **Ricerca** per PFS, splitter, ID o permuta; **PDF / Excel** per splitter o cartella intera; **Condividi** su WhatsApp.
- Dalla cartella PFS: **📍 Naviga** se il PFS ha una posizione salvata, altrimenti **📍 Posizione** per salvarla.

### PFS Qui
- **Aggiungi PFS**: codice (l'anello viene riconosciuto in automatico, es. `NA_05/08W22` → anello `NA_05`), coordinate con **Posizione attuale** (GPS) oppure incollando coordinate o un link di Google Maps, note di accesso e foto.
- **Importa da Google My Maps**: incolli il link della mappa con i PFS e l'app scarica tutti i punti (anche migliaia), li divide per anello e li invia al foglio a blocchi. Ripetendo l'importazione si aggiornano le posizioni cambiate; quelle corrette a mano restano com'erano (salvo *Sostituisci anche le posizioni inserite a mano*). Si può usare anche un file KML/KMZ esportato da My Maps, oppure un link rapido `…/fiber-tools/#importa=<link della mappa>`.
- **Condividi posizioni**: crea un file (KML) con tutti i PFS, un anello, i risultati di una ricerca o solo quelli aggiunti/corretti a mano, e lo invia su WhatsApp, email ecc. (dove il telefono non permette di inviare .kml viene inviato come .txt, che si importa allo stesso modo). Anche un singolo PFS si può inviare come file.
- **Importa posizioni da file**: il collega carica il file ricevuto in *PFS Qui → Importa posizioni → Scegli il file*, **anche offline**. Vince la posizione più recente: le correzioni fatte a mano più nuove sul suo telefono restano. Il file si apre anche in Google Earth / My Maps.
- **Elenco per anello** con ricerca per PFS, anello o note (`NA_01 16e13` e `NA_01/16E13` sono lo stesso PFS); **Vicino a me** ordina i PFS per distanza.
- **Mappa** con un colore per ogni anello; **Naviga** apre Google Maps con il percorso fino al PFS.
- **Mappa offline**: *Mappa offline → Salva questa zona* salva sul telefono la zona inquadrata (fino a zoom 16, max 2.500 tasselli a zona, 8.000 in tutto). Anche le zone guardate con la rete restano salvate. Senza campo la mappa mostra le zone salvate. Si può svuotare dallo stesso pulsante.
- **Vedere e salvare** richiede un account approvato, **eliminare** un amministratore (verificato dallo script).

### Foto GPS
- **Foto e video** dalla fotocamera con un timbro in basso: via e numero civico, CAP, città e provincia, regione, coordinate GPS con precisione, data e ora. Facoltativi: il **PFS più vicino** (entro 150 m, con l'accesso) e una **nota** (es. numero pratica).
- L'indirizzo viene ricavato dalle coordinate con **OpenStreetMap**. Senza rete il timbro mostra comunque coordinate, data e ora.
- Le **foto** contengono anche la posizione GPS nei dati EXIF, quindi la galleria le mostra sulla mappa.
- **Salvataggio**: su Android vanno subito nella galleria (album *Download*). Su iPhone si tocca *Salva in Foto* → *Salva immagine / Salva video*. C'è anche *Condividi* (WhatsApp, email…).
- I **video** (fino a 10 minuti, con audio) sono in MP4 dove il telefono lo permette, altrimenti WebM.

### Schema di Giunzione
- Si sceglie la **rete**, la **capacità** dei due cavi (12–432 fibre), la **fibra iniziale** di ciascuno e **quante fibre** giuntare: la tabella si aggiorna mentre scrivi.
- **Tubetti**: fino a 48 fibre da 12, da 96 a 192 da 24, da 288 a 432 da 36. Le fibre 13–24 del tubetto sono **anellate**, le 25–36 **doppio anellate** (il nero diventa trasparente).
- Avvisi se le fibre superano la capacità del cavo 1 o se il cavo 2 non basta. Esporta in **testo**, **PDF** ed **Excel**; funziona anche offline e ricorda gli ultimi valori.

### Contatti
- Pulsante ✉️ nella barra in alto, accanto all'ingranaggio: mostra l'indirizzo **marigliano.lavoro@gmail.com** e un modulo (argomento, nome, messaggio). **Invia mail** apre l'app di posta con oggetto e testo già pronti.

### Sempre attivi
- **Coda offline**: se manca la rete, salvataggi ed eliminazioni restano in coda (barra arancione in alto) e partono da soli quando torna la connessione.
- **Backup**: ⚙️ Impostazioni → *Scarica* / *Ripristina*, utile per cambiare telefono.
- **Avviso aggiornamento** quando viene pubblicata una nuova versione.
- **Maiuscole automatiche** su tutti i campi.

## Installare l'app sul telefono
- **Android (Chrome)**: apri il link e tocca **Installa** nel riquadro della home (oppure menu ⋮ → *Installa app*).
- **iPhone (Safari)**: apri il link, tocca **Condividi** → **Aggiungi alla schermata Home**.

## Account e permessi

- **Senza account** si usano liberamente gli strumenti: colori, PFS/PTE, Calculator, FiberCop, modulo ribattitura (copia/condividi), barcode, Foto GPS, schema di giunzione.
- **I dati sono riservati**: archivio ribattiture, storico e posizioni PFS (elenco, mappa, navigazione, importa/condividi) si vedono **solo con un account approvato**. Un avviso in home e nelle schermate lo spiega. Uscendo dall'account i dati vengono tolti dal telefono.
- **Registrazione**: *Accedi → Registrati* con nome, **società per cui lavori**, email e password. La richiesta resta **in attesa** finché un amministratore non la approva.
- **Società**: resta salvata nell'account (colonna *SOCIETA* del foglio *Utenti*) e compare in *Gestione utenti*, dove gli amministratori possono correggerla. Agli account creati prima viene chiesta una volta sola.
- **Ruoli**: *Proprietario* (il primo account registrato) → gestisce tutto e nomina gli amministratori; *Amministratore* → elimina ribattiture e PFS, approva e blocca i tecnici; *Tecnico* → salva.
- **Gestione utenti**: pulsante account in alto → *Gestione utenti* (approva, rifiuta, blocca, riattiva, elimina, nomina amministratore).
- **Ultimo accesso**: in *Gestione utenti* ogni account mostra quando ha usato l'app l'ultima volta (adesso, oggi, ieri, N giorni fa) e da quale dispositivo (es. *Android · Chrome · app*). In alto il riepilogo: attivi oggi, negli ultimi 7 giorni, da più di 7 giorni. Si può ordinare per ultimo accesso, nome o società. Viene aggiornato a ogni apertura e sincronizzazione dell'app, al massimo ogni 10 minuti (colonne *ULTIMO_ACCESSO* e *DISPOSITIVO* del foglio *Utenti*).
- **Statistiche e backup** (amministratori): pulsante account → *Statistiche e backup*. Ribattiture e posizioni PFS per tecnico o per società, nel periodo scelto (7 giorni, 30 giorni, mese, anno, tutto), attività giorno per giorno ed esportazione in Excel. Sotto c'è lo stato del backup e *Backup adesso*.
- **Password dimenticata**: ci si registra di nuovo con la stessa email; la nuova password si attiva dopo l'approvazione (fino ad allora vale quella vecchia).
- I controlli li fa lo **script Google**, non il telefono: le password sono salvate solo come impronta con sale (foglio *Utenti*), gli accessi sono firmati e un account bloccato smette di funzionare subito. Il proprietario può correggere stato e ruolo anche a mano nel foglio *Utenti*.

## Script Google Sheets

Lo script ([`apps-script/Code.gs`](apps-script/Code.gs), versione 7) gestisce ribattiture, posizioni PFS, foto, storico, account, statistiche e backup.

1. Apri il foglio Google collegato all'app → **Estensioni → Apps Script**.
2. Sostituisci il contenuto di `Code.gs` con quello del repository e salva.
3. **Esegui il deployment → Gestisci deployment** → modifica (✏️) il deployment esistente → *Versione*: **Nuova versione** → **Esegui il deployment** (Esegui come: *Me*, Accesso: *Chiunque*). Così l'indirizzo resta lo stesso.
4. Per le **foto** e il **backup** lo script deve poter usare Google Drive: nell'editor scegli la funzione `attivaBackupSettimanale` → **Esegui** e autorizza. Così parte il primo backup e da lì una copia del foglio ogni domenica alle 3, nella cartella Drive **Fiber Tools Backup** (restano le ultime 8).

Fogli creati in automatico: **Ribattiture**, **PFS_Posizioni**, **Storico**, **Utenti**. Le foto vanno nella cartella Drive **Fiber Tools Foto**.

## Struttura del progetto

```
index.html              app completa (HTML, CSS, JavaScript)
manifest.webmanifest    installazione come app
sw.js                   funzionamento offline
icons/                  icone dell'app
vendor/                 lettore codici a barre (zxing) e mappa (Leaflet)
apps-script/Code.gs     script Google Sheets v7 (archivio riservato, account, statistiche, backup)
```

Quando modifichi i file, aumenta `VERSION` in `sw.js` così i telefoni scaricano la versione nuova.

## Note sulla sicurezza
- L'archivio (ribattiture, storico, posizioni PFS) è **leggibile solo con un account approvato**: lo script lo restituisce solo a chi invia un accesso valido e attivo. Scrivere richiede un account approvato, eliminare un amministratore.
- Facoltativo: con la proprietà script `TEAM_KEY` anche la lettura richiede un codice squadra.
- Le foto su Drive sono visibili a chi ha il link della singola foto.

## Crediti
Lettura codici a barre: [barcode-detector](https://github.com/Sec-ant/barcode-detector) e [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (MIT), basati su [ZXing-C++](https://github.com/zxing-cpp/zxing-cpp) (Apache 2.0).
Mappa: [Leaflet](https://leafletjs.com) (BSD-2) con dati © [OpenStreetMap](https://www.openstreetmap.org/copyright).
