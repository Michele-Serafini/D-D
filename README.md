# Mercante Errante — Compendium e VTT per D&D

Compendium per D&D con negozio, combattimento, mappe, libri, regia sonora e schede personaggio multi-sistema.

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
- **Pulsante Rapido `✦ FX ON / OFF`**: presente nella barra in alto a destra e nel footer della sidebar per disattivare gli effetti pesanti su dispositivi lenti.

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
