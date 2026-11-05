# Mercante Errante — Compendium e VTT per D&D

Compendium per D&D con negozio, combattimento, mappe, libri, regia sonora e schede personaggio multi-sistema.

## Installazione sul telefono e schede offline

Apri **Telefono e offline** nel menu. Su Chrome/Edge puoi usare **Installa sul
telefono** quando il browser propone l’installazione. Su iPhone/iPad apri il sito
in Safari e scegli **Condividi → Aggiungi alla schermata Home**; sugli altri
browser usa la voce di installazione del menu, se disponibile.

Dall’app o dal browser in cui vuoi consultare le schede, accedi, entra nella
campagna e premi **Prepara schede offline**. I giocatori salvano le proprie
schede; i master possono salvare quelle della campagna. Prima di perdere la rete
usa **Aggiorna schede offline** per una copia recente. La copia comprende dati,
inventario e immagini già incorporate o presenti nella lavagna locale; le
immagini ospitate su altri siti possono richiedere una connessione.

Senza rete, riaprire il sito mostra un lettore autonomo in sola lettura, con data
della copia e modifiche locali in attesa. Il lettore non richiede Firebase o font
esterni. I dati sono conservati in IndexedDB sul dispositivo: usa solo telefoni
personali. Un altro account non vede le copie dell’account precedente; uscire
blocca l’accesso dal lettore finché non accedi nuovamente online.

Le modifiche alle schede fatte nel sito aperto passano prima da una coda locale.
La barra **Schede** distingue i dati sincronizzati da quelli sul dispositivo.
La coda sopravvive a ricaricamenti e si svuota solo dopo la conferma di Firebase.
Per sincronizzare dopo una riapertura offline, torna al sito con rete, accedi allo
stesso account ed entra nella stessa campagna. Non serve ripetere la modifica.
Se i campi sono cambiati anche online, **Telefono e offline** mostra un conflitto:
puoi confrontare i valori, esportare la copia locale, mantenere quelli online
oppure applicare esplicitamente i tuoi. Gli altri campi e gli acquisti restano
intatti. Acquisti, ricompense, eliminazioni e ripristini richiedono connessione.
La copia offline può essere rimossa quando non ci sono modifiche in attesa.

Il service worker conserva solo le risorse del lettore (`scripts/pwa-assets.mjs`),
con cache versionata e limitata al percorso del repository. Non conserva risposte
Firebase, credenziali, pannello admin, cataloghi o bozze segrete. I moduli della
coda e dell’interfaccia sono in `js/features/offline/`; l’archivio condiviso e il
lettore indipendente sono in `js/pwa/`. Nessuna chiave o servizio aggiuntivo è
necessario. Per i test browser, `DD_BROWSER_TEST=1` esclude gli SDK Firebase reali:
il backend simulato viene ripristinato anche nelle pagine controllate dal worker.

## Contenuti segreti e rivelabili

Nel menu **Contenuti e segreti**, il master prepara luoghi, NPC, immagini e indizi.
**Salva bozza** conserva il contenuto riservato; **Rivela ai giocatori** pubblica
una copia nella sezione **Contenuti rivelati** degli altri partecipanti. Le note
segrete del master sono escluse dalla copia condivisa, anche dopo la rivelazione.

Le modifiche a una bozza già rivelata restano private finché il master preme
**Aggiorna per i giocatori**. **Nascondi ai giocatori** ritira la copia pubblicata
senza cancellare la bozza; **Elimina** rimuove entrambe. L’aggiornamento è in tempo
reale per chi ha aperto la sezione. I contenuti sono separati per campagna.

Le immagini si possono caricare dal dispositivo o indicare con un URL HTTPS.
Gli upload vengono ridimensionati a 1600 pixel e compressi in JPEG, conservati
nel database della campagna; non dipendono dall’archivio locale del master.

I moduli sono raccolti in `js/features/reveals/`. Le regole del database separano
`secretContent` (solo master) da `revealedContent` (partecipanti); la copia
pubblicata deve coincidere con una revisione salvata e non ammette campi privati.
Le bozze modificate contemporaneamente richiedono di riaprire l’ultima versione.

## Account, temi e animazioni

Il pulsante **Account e impostazioni**, all’inizio della sidebar, apre l’unico
pannello per profilo, password, animazioni e **Esci e cambia account**. I sei temi
sono subito accessibili nella sidebar tramite **Tema del sito**.
La stessa area ospita il **D20 rapido**. Sono state rimosse la barra flottante
tema/animazioni, la coppia ingranaggio/badge e i pulsanti duplicati di logout.
Su mobile i comandi sono nel menu laterale e non coprono schede o altri contenuti.

## Storico e ripristino delle schede

La voce **Storico e ripristino**, disponibile anche sopra ogni scheda, mostra chi
ha cambiato ciascun campo, quando e i valori prima/dopo. Il proprietario vede le
proprie schede; i master vedono quelle della campagna corrente. Funziona con tutti
i sistemi di scheda e registra anche acquisti e ricompense.

Seleziona una versione, apri **Anteprima ripristino** e controlla i campi prima di
confermare. Il ripristino crea una nuova versione: anche il ripristino può essere
annullato recuperando lo stato precedente. Se la scheda cambia mentre esamini
l’anteprima, aggiorna lo storico prima di riprovare.

Gli oggetti del negozio e le ricevute restano attuali. Se dopo la versione scelta
ci sono acquisti o ricompense, anche le monete restano attuali: il ripristino non
rimborsa acquisti né duplica ricompense. In assenza di operazioni successive si
possono recuperare anche modifiche accidentali alle monete.

Lo storico parte dal primo salvataggio effettuato con questa funzione: non può
ricostruire modifiche precedenti. Conserva i dati e i riferimenti delle immagini;
le immagini cancellate dall’archivio locale IndexedDB non vengono ricreate.
Le versioni cancellate dal database da un amministratore non sono recuperabili.

`js/features/sheets/history-model.js` calcola differenze e ricostruisce le versioni;
`history-service.js` salva scheda e registro insieme, con contatore e ritentativi
per le collisioni; `history-view.js` gestisce l’interfaccia. Il database conserva
solo i campi cambiati, non una copia completa a ogni tasto. La pagina carica 30
versioni alla volta. Le regole sono mantenute in `scripts/sheet-history-rules.mjs`.
Le schede già esistenti restano compatibili con i vecchi client fino al primo
salvataggio nello storico; da quel momento tutti gli aggiornamenti richiedono
una revisione atomica. Aggiornare le schede da client recenti.

## Diario automatico della sessione

Il master apre **Diario della sessione** dalla barra laterale o dalla dashboard,
inserisce un titolo e avvia la sessione. La chiusura conserva il registro e rende
disponibile la sessione precedente per preparare un riepilogo modificabile e
scaricabile in Markdown. Il diario e le bozze sono privati per i master della campagna.

Vengono registrati automaticamente i tiri segnati come importanti e i naturali 1/20
(anche con modificatori, vantaggio e D20 rapido), l'inizio e la fine dei combattimenti,
le ricompense effettivamente applicate alle schede e gli appunti salvati dalla dashboard.
**Avvia combattimento** e **Termina combattimento** sono disponibili nello stesso
tracker di Iniziativa; il primo avanzamento del turno avvia automaticamente il
combattimento se necessario. Il diario conserva un solo checkpoint degli appunti
per master e sessione; le annotazioni manuali sono voci separate. Un combattimento
ancora aperto viene riepilogato alla chiusura della sessione e può proseguire nella successiva.

Gli eventi usano identificativi stabili e vengono scritti insieme alla loro fonte.
Se la consegna al diario fallisce, il tiro o la ricompensa resta salvato e l'evento
viene conservato in una coda locale per utente e campagna. La sincronizzazione riparte
alla riapertura, alla riconnessione o dal pulsante **Sincronizza eventi in attesa**.
Le bozze modificate restano anche localmente fino alla conferma del salvataggio.
Il riepilogo usa gli eventi registrati; non richiede servizi AI o chiavi aggiuntive.

Modello, sincronizzazione e interfaccia sono separati in `js/features/journal/`.
I dati sono sotto `campaigns/<id>/data/sessionJournal`: controllo e metadati in
`control`, eventi in `events/<sessione>` e riepiloghi in `drafts/<sessione>`.
Le regole in `scripts/journal-rules.mjs` consentono ai giocatori di aggiungere solo
un evento per un proprio tiro importante salvato, senza leggere il diario privato.
I controlli coprono anche eventi ripetuti, tentativi di modifica e isolamento fra campagne.

## Negozio collegato alle schede

**Acquista** nei cataloghi e nel negozio generato permette di scegliere personaggio e quantità.
**Inventario e acquisti** mostra monete, oggetti e richieste del giocatore. Il master
usa **Negozio e ricompense**, anche dalla dashboard, per approvare, rifiutare o
assegnare oggetti e denaro. L'approvazione è attiva per impostazione predefinita e
si può disattivare per la singola campagna. In attesa non viene addebitato nulla;
se i fondi non bastano, l'operazione resta in attesa e si può annullare o riprovare.

Il pannello **Inventario, monete e acquisti** è disponibile nella scheda di tutti
i sistemi. Gli oggetti identici dello stesso catalogo hanno una sola voce con
quantità. L'equipaggiamento testuale esistente rimane disponibile. Le monete
usano i campi della scheda: rame, argento, oro, platino, crediti, Berry, soldi Pokémon
e Ryō. Il cambio fra monete D&D è automatico; le altre valute restano indipendenti.
Gli oggetti senza prezzo possono essere assegnati dal master come ricompensa.

`commerce-model.js` contiene contabilità e inventario; `commerce-service.js` gestisce
richieste, approvazioni e ricompense. Interfaccia e dialogo sono separati. `SheetStore`
salva soltanto i campi modificati, preparati prima del debounce, e conserva gli
aggiornamenti remoti. La creazione della prima scheda salva anche il marcatore `_v2`.

Ogni operazione conserva il proprio ID anche in caso di retry. Richieste e ricevute
sono separate dai dati ripristinabili della scheda, in `commerceRequests/<utente>/<pg>`
e `commerceReceipts/<utente>/<pg>` sotto `campaigns/<id>/data`. Monete, quantità,
versione e ricevuta cambiano con un solo aggiornamento atomico: una versione superata
viene rifiutata e riprovata sui dati correnti. Le regole per approvazioni, ricompense
e ricevute sono centralizzate in `scripts/commerce-rules.mjs` e incluse nel generatore
RTDB. I backup JSON non sostituiscono il registro delle operazioni.

## Dashboard del master

Il master entra nella dashboard dopo aver scelto la campagna e può riaprirla dalla
barra laterale. Ordine dei turni, round, punti vita e condizioni usano lo stesso
tracker della schermata **Iniziativa** e si aggiornano in tempo reale. I pulsanti
**−1 / +1** modificano i punti vita; un clic nell'ordine dei turni seleziona il
combattente attivo senza avanzare il round. I comandi rapidi aprono mappe, schede,
generatore PNG, dadi, libri e regia sonora.

Gli **Appunti del master** sono condivisi fra i master della campagna e protetti
dalle regole esistenti di `campaigns/<id>/data/dmConfig/dashboardNotes`. Sono
separati dalle note dei giocatori, si salvano automaticamente e conservano una
bozza locale per utente e campagna finché il server conferma il salvataggio.
Una bozza recuperata si salva con **Salva appunti** o continuando a scrivere.
Il cambio campagna attende il salvataggio degli appunti pendenti.

---

## Campagne separate

Dopo il login si sceglie una campagna. Il master può crearne una indicando nome, descrizione e partecipanti. **Gestisci giocatori** permette di aggiungere o togliere membri e assegnare il ruolo di giocatore o master per quella campagna, senza cambiare il loro account globale. Il proprietario resta master. Gli amministratori della piattaforma, incluso il master principale, possono gestire tutte le campagne.

**Cambia campagna** nella barra laterale torna alla scelta. Prima del cambio vengono completati i salvataggi pendenti; la pagina viene ricaricata per rilasciare tutti i listener, timer, mappe e cache delle schede. Firebase verifica l'identità esistente, senza chiedere la password per un normale cambio campagna. Un nuovo accesso continua a mostrare la scelta delle campagne.

Account e credenziali restano globali. I dati di gioco passano esclusivamente da `CampaignManager` e da `_campaignDb`, sotto `campaigns/<id>/data/`: schede, pet, mappe, note, libri personalizzati, negozi, storie, dadi e contenuti del gruppo. `campaignAccess/<username>` serve a elencare le campagne; le regole verificano sempre l'appartenenza effettiva in `campaigns/<id>/members`. Un master di una campagna non ottiene accesso alle altre campagne. Rimozione dal gruppo e disabilitazione dell'account revocano l'accesso anche nelle sessioni aperte.

Snapshot locali e immagini IndexedDB hanno chiavi distinte per utente e campagna. Gli snapshot locali restano conservati in base al proprietario. Cataloghi e risorse statiche del repository restano disponibili come base comune per tutte le campagne.

L'inizializzazione del database popola i dati base nella **Campagna principale**. L'operazione è idempotente e usa una transazione: due accessi amministrativi contemporanei non possono sovrascriverla. Le preferenze per la struttura iniziale sono in `config/campaigns.json`.

Per verificare le regole con un database locale simulato: `npm run test:rules` (richiede Java 21). La CI esegue questo controllo oltre ai test dei tre browser. L’override gRPC in `package.json` applica le correzioni di sicurezza alla dipendenza transitiva dell’SDK Firebase usato dai test.

---

## Struttura del codice

```text
config/
  accounts.json          Regole dei nomi, ruoli, titoli e icone predefiniti per ruolo
  firebase.web.json      Metadati del progetto Firebase, senza chiavi
  assets.mjs             Ordine dei sorgenti del bundle applicativo
  browsers.mjs           Target comuni di compilazione JavaScript e CSS
js/
  users.js               Autenticazione, profili, privilegi e operazioni sugli account
  party-admin.js         Interfaccia di amministrazione
  core/                  Stato, sincronizzazione, storage, IndexedDB e avvio
  ui/                    Navigazione, filtri e impostazioni dell’account
  features/              Negozio, combattimento, mappe, libri, NPC, dadi e schede
  sheets/                Schede Brancalonia, Star Wars, Pokémon e Naruto
css/
  variables.css          Variabili di tutti i temi e della palette cyber
  components/            Stili divisi per area del sito
  legacy.css             Solo import ordinati dei componenti
  site.css               Unico ingresso degli stili della pagina principale
  compatibility.css      Viewport, accessibilità e compatibilità fra browser
scripts/                 Build, configurazioni generate e controlli dei segreti
tests/                   Test funzionali e test browser con backend simulato
data/, img/, audio/, schede/  Cataloghi e risorse originali conservati
```

`js/app.js` è **generato**, escluso da Git e non va modificato. Vite unisce i file elencati in `config/assets.mjs` mantenendo l’ordine e le funzioni globali richieste dalle schede e dai controlli esistenti. Lo sviluppo usa i sorgenti leggibili; la produzione riceve un solo bundle compatto. Le parti del bundle non vengono copiate una seconda volta in `dist/`.

---

## 👤 1. Account e amministrazione

Il database Firebase è l’unico elenco degli account. Per aggiungere, rimuovere, riattivare un giocatore o cambiarne titolo, icona e privilegi, usa **`admin.html`**: non occorre modificare alcun file. Le password si cambiano nelle impostazioni dell’account e rimangono in Firebase Authentication. Non esiste un elenco di nomi predefiniti nei sorgenti.

I nomi validi per il login sono quelli degli account effettivamente creati nel database. `config/accounts.json` definisce soltanto le regole comuni degli account e i valori predefiniti dei ruoli; la stessa configurazione viene usata dal client e dal generatore delle regole del database. `database.rules.json` è generato con `npm run rules:build`, eseguito anche prima del deploy.

| Account | Password iniziale | Ruolo |
| --- | --- | --- |
| Master | dungeonmaster | Dungeon Master |
| Player1 | player | Giocatore |
| Player2 | player | Giocatore |
| Player3 | player | Giocatore |

Apri `admin.html` con `admin` / `admin` per consultare il database, aggiungere un giocatore dal modulo e rimuoverlo con il relativo pulsante. Il master può accedere alla stessa pagina. L'account di manutenzione `admin` è separato dai quattro utenti del party. I nomi vengono normalizzati in minuscolo.
La rimozione revoca l'accesso anche nella sessione aperta e conserva eventuali mappe/worldbuilding personali. Il master non è rimovibile dal pulsante giocatori.
Il visualizzatore legge un percorso alla volta, con massimo 25 elementi, maschera password e chiavi e abbrevia i contenuti lunghi.

### Progetto Firebase

Il progetto Firebase di riferimento è **mercante-errante-dd-2026**. I metadati Web pubblici sono in `config/firebase.web.json`. La chiave viene letta dalla variabile `FIREBASE_WEB_API_KEY`; `js/firebase-config.js` viene generato da Vite in sviluppo e durante la build, senza essere versionato. Nessun token CLI, refresh token o account di servizio viene salvato nel repository.

L’accesso usa **Firebase Authentication email/password**, con alias interni `<username>@dd.local`; nell’interfaccia continui a inserire solo username e password. L’account admin è una vera identità Firebase separata dai membri del party. Le password non sono memorizzate in Realtime Database e non vengono confrontate nel browser. Per le nuove password Firebase richiede almeno 6 caratteri.

`users/<nome>` contiene solo profilo e privilegi; `userAccess/<uid>` collega l’identità Auth al nome. Le regole server impediscono l’accesso agli utenti non abilitati o rimossi e impediscono ai player di assegnarsi privilegi amministrativi. L’admin può aggiungere, rimuovere e riattivare un giocatore; rimuoverlo conserva i contenuti personali ma revoca l’accesso al database.

Il database è in `europe-west1`. I backup completi rimangono locali, esclusi da Git in `work/`. 

Per distribuire configurazione Auth e regole sul progetto:

```sh
npx -y firebase-tools@latest deploy --only auth,database --project mercante-errante-dd-2026
```

### Sorgenti e build

Richiede Node.js 24.12 o successivo, coerente con gli strumenti di test Firebase.

I file canonici sono in `js/`, `css/`, `data/`, `img/`, `audio/` e `schede/`. Gli URL dei JSON e delle schede vengono generati direttamente da queste sorgenti. Vite le serve direttamente in sviluppo; il plugin `scripts/static-assets.mjs` include le risorse in `dist/`. Vite compila entrambe le pagine, `index.html` e `admin.html`.

```sh
npm install
cp .env.example .env.local
# Imposta FIREBASE_WEB_API_KEY in .env.local prima di avviare il sito.
npm run dev
npm run build
npm run test:party
```

---

## ⚔️ 2. Come Aggiungere un Nuovo Oggetto, Mostro, Incantesimo o Traccia Audio

Tutti i contenuti si trovano nella cartella `data/` e **ogni nuovo elemento eredita automaticamente lo stile, il bagliore di rarità e le animazioni 3D**.

### Aggiungere un Oggetto o Arma all'Emporio
Apri `data/catalog-data.js` e aggiungi un oggetto dentro `SRD_OGGETTI` (oppure usa il pulsante **"+ Nuovo Oggetto"** direttamente dal sito come DM):
```javascript
{
  id: "custom_spada_1",
  nome: "Lama dell'Eclissi",
  tipo: "Spada lunga",
  rarita: "Leggendario", // Comune | Non comune | Raro | Molto raro | Leggendario | Arma unica | Arma divina
  prezzo: 5000,
  valuta: "mo",          // mr | ma | mo | mp
  immagine: "img/mia-spada.jpg",
  descrizione: "Una lama forgiata nell'ombra che infligge +2d6 danni necrotici."
}
```

### Aggiungere un Mostro al Bestiario
Apri `data/catalog-data.js` e aggiungi una voce in `SRD_BESTIARIO`.

---

## 🎨 3. Come Cambiare Colori, Temi e Font

Apri **`css/variables.css`**: tutte le scelte cromatiche e tipografiche sono raccolte nelle prime righe!

```css
:root {
  --font-display: 'Cinzel', Georgia, serif;
  --font-body: 'Plus Jakarta Sans', sans-serif;
}
```

---

## ✨ 4. Come Regolare le Animazioni (Portale Login, Dadi 3D, Transizioni Sezioni)

- **Cerimonia di Login ("Portale Runico & Doppio Battente")**: definita in `js/ui/account-panel.js` (`playLoginPortalCeremony`) e in `css/animations.css` (`.sium-login-portal`, `.portal-door-left`, `.portal-door-right`).
- **Arena Dadi 3D Poliedrica**: nella sezione **Lanciatore Dadi** (`renderDadi` in `js/features/dice.js` + `build3DDieElement` in `js/animations.js`) tutti i dadi (`d4, d6, d8, d10, d12, d20, d100`) vengono lanciati in 3D con rimbalzo fisico, ombra dinamica sul velluto e onda d'urto runica all'impatto.
- **Transizioni al Click sulle Sezioni**: ogni volta che clicchi su una sezione del menu laterale, compare l'**Araldo Runico** della sezione (`SECTION_HERALDS` in `js/animations.js`), la pagina si srotola in 3D (`siumSectionUnroll3D`) e tutti gli elementi entrano con animazione scaglionata (`sium-reveal`).
- **Animazioni ON / OFF**: nel pannello **Account e impostazioni**, per disattivare gli effetti pesanti sui dispositivi lenti.

---

## ⚙️ 5. Manutenzione

- La gestione account, privilegi, presenza e listener è in `js/users.js`; `js/party-admin.js` gestisce l’interfaccia di amministrazione.
- `render()` e `renderMain()` condividono lo stesso instradamento delle sezioni e la pulizia dei listener.
- Il sito usa JavaScript e CSS statici.
- `npm test` controlla dati, login, revoca degli account, persistenza e pulizia dei listener.
- `npm run test:browsers` verifica Chromium, Firefox/Gecko e WebKit con Firebase simulato, senza contattare il database reale. Per installare i browser: `npx playwright install --with-deps chromium firefox webkit`.
- I test browser usano una chiave fittizia e `dist-test/`, anche con il percorso GitHub Pages `/D-D/`. Coprono utenti, navigazione, negozi, temi, mappe, sette sistemi di schede e IndexedDB.
- I target di compilazione sono Chrome/Chromium 109+, Firefox 115+ e Safari 16.4+. I test eseguono le versioni dei motori fornite da Playwright.
- `npm run format` e `npm run format:check` mantengono una formattazione uniforme dei sorgenti scritti a mano.
- I salvataggi locali ravvicinati vengono raggruppati; cambio scheda e chiusura forzano il salvataggio finale. IndexedDB riusa una connessione e conferma le scritture a transazione completata.
- Il motore delle mappe viene caricato dal sito solo quando serve. Le immagini delle card usano caricamento differito e decodifica asincrona; gli effetti si fermano a pagina nascosta e rispettano le preferenze di movimento ridotto.
- Le espressioni di autorizzazione RTDB si mantengono in `scripts/build-database-rules.mjs`. `npm run rules:build` rigenera `database.rules.json`; il deploy Firebase lo esegue automaticamente.

### Configurazione API e Gestione Segreti

Impostare `FIREBASE_WEB_API_KEY` in `.env.local` per lo sviluppo e nell’ambiente della piattaforma che esegue la build per la produzione. La build si interrompe se la variabile manca; l'applicazione non usa chiavi predefinite né valori codificati nel sorgente. 

La configurazione generata resta visibile al browser, come previsto dall’SDK Web Firebase: la protezione dei dati dipende esclusivamente da Authentication, dalle regole di sicurezza del server (RTDB) e dalle restrizioni applicate alla chiave per i soli servizi Google consentiti (Identity Toolkit, Secure Token e Realtime Database). Il valore della chiave operativa è reperibile in Google Cloud, all'interno del progetto `mercante-errante-dd-2026` sotto la sezione Credenziali (etichettata come **Mercante Errante browser runtime**).

Lo script `npm run check:secrets` controlla costantemente tutti i file di testo versionabili e il contenuto preparato per il commit nell’indice Git, impedendo commit involontari di chiavi o configurazioni sensibili. Viene eseguito automaticamente prima della build e nelle verifiche GitHub Actions (che utilizzano una chiave fittizia).

Per pubblicare il sito tramite **GitHub Pages**, la distribuzione non avviene con un semplice push su `main`, ma tramite il workflow dedicato che processa `dist/` sul percorso `/D-D/`:

1. In **Settings → Secrets and variables → Actions**, aggiungi il repository secret `FIREBASE_WEB_API_KEY` valorizzato con la chiave operativa.
2. In **Settings → Pages → Build and deployment → Source**, imposta **GitHub Actions**.
3. In **Actions → Publish GitHub Pages → Run workflow**, avvia la pubblicazione.

Il workflow interrompe la build in caso di mancanza del secret e non scrive mai il suo valore nei log o nei sorgenti esposti. La build minifica JSON e JavaScript, mantenendo perfettamente intatti nomi globali e URL funzionali per la navigazione.
