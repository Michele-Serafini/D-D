# Mercante Errante — Compendium e VTT per D&D

Compendium per D&D con negozio, combattimento, mappe, libri, regia sonora e schede personaggio multi-sistema.

---

## Campagne separate

Dopo il login si sceglie una campagna. Il master può crearne una indicando nome,
descrizione e partecipanti. **Gestisci giocatori** permette di aggiungere o togliere
membri e assegnare il ruolo di giocatore o master per quella campagna, senza
cambiare il loro account globale. Il proprietario resta master. Gli amministratori
della piattaforma, incluso il master principale, possono gestire tutte le campagne.

**Cambia campagna** nella barra laterale torna alla scelta. Prima del cambio vengono
completati i salvataggi pendenti; la pagina viene ricaricata per rilasciare tutti i
listener, timer, mappe e cache delle schede. Firebase verifica nuovamente l'identità
esistente, senza chiedere la password per un normale cambio campagna. Un nuovo
accesso continua a mostrare la scelta delle campagne.

Account e credenziali restano globali. I dati di gioco passano esclusivamente da
`CampaignManager` e da `_campaignDb`, sotto `campaigns/<id>/data/`: schede, pet,
mappe, note, libri personalizzati, negozi, storie, dadi e contenuti del gruppo.
`campaignAccess/<username>` serve a elencare le campagne; le regole verificano
sempre l'appartenenza effettiva in `campaigns/<id>/members`. Un master di una
campagna non ottiene accesso alle altre campagne. Rimozione dal gruppo e
disabilitazione dell'account revocano l'accesso anche nelle sessioni aperte.

Snapshot locali e immagini IndexedDB hanno chiavi distinte per utente e campagna.
I vecchi snapshot locali senza proprietario restano conservati e non vengono
caricati automaticamente in un altro account. Cataloghi e risorse statiche del
repository restano disponibili come base comune delle nuove campagne.

La migrazione iniziale conserva i dati esistenti nella **Campagna principale**.
È idempotente e usa una transazione: due accessi amministrativi contemporanei non
possono sovrascriverla. Le vecchie mappe nei profili vengono trasferite nella
campagna e archiviate in un ramo riservato agli amministratori. Le preferenze della
migrazione sono in `config/campaigns.json`.

Per verificare le regole con un database locale simulato: `npm run test:rules`
(richiede Java 21). La CI esegue questo controllo oltre ai test dei tre browser.

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

`js/app.js` è **generato**, escluso da Git e non va modificato. Vite unisce i file
elencati in `config/assets.mjs` mantenendo l’ordine e le funzioni globali richieste
dalle schede e dai controlli esistenti. Lo sviluppo usa i sorgenti leggibili; la
produzione riceve un solo bundle compatto. Le parti del bundle non vengono copiate
una seconda volta in `dist/`.

---

## 👤 1. Account e amministrazione

Il database Firebase è l’unico elenco degli account. Per aggiungere, rimuovere,
riattivare un giocatore o cambiarne titolo, icona e privilegi, usa **`admin.html`**:
non occorre modificare alcun file. Le password si cambiano nelle impostazioni
dell’account e rimangono in Firebase Authentication. Non esiste un elenco di nomi
predefiniti nei sorgenti.

Cambiare i vecchi nomi descrittivi in `Master`, `player1`, `player2`, `player3`
non creava o rinominava identità Firebase. I nomi validi per il login sono quelli
degli account effettivamente creati; il refactoring non rinomina gli account esistenti.

`config/accounts.json` definisce soltanto le regole comuni degli account e i
valori predefiniti dei ruoli; la stessa configurazione viene usata dal client e
dal generatore delle regole del database. `database.rules.json` è generato con
`npm run rules:build`, eseguito anche prima del deploy.

| Account | Password iniziale | Ruolo |
| --- | --- | --- |
| sebastiano | dungeonmaster | Dungeon Master |
| michele | player | Giocatore |
| montre | player | Giocatore |
| alessio | player | Giocatore |

Apri `admin.html` con `admin` / `admin` per consultare il database, aggiungere
un giocatore dal modulo e rimuoverlo con il relativo pulsante. Il master può
accedere alla stessa pagina. L'account di manutenzione `admin` è separato dai
quattro utenti del party. I nomi vengono normalizzati in minuscolo.
La rimozione revoca l'accesso anche nella sessione aperta e conserva eventuali
mappe/worldbuilding personali. Il master non è rimovibile dal pulsante giocatori.
Il visualizzatore legge un percorso alla volta, con massimo 25 elementi,
maschera password e chiavi e abbrevia i contenuti lunghi.

### Nuovo progetto Firebase

**Stato operativo, 30 ottobre 2026:** le regole RTDB per le campagne sono pubblicate
nel nuovo progetto. I contenuti predisposti per la migrazione sono stati importati
nella Campagna principale con una scrittura condizionale, consentita soltanto su
database vuoto. È stato verificato un login reale e l'accesso alla campagna, insieme
al rifiuto degli accessi anonimi, ai percorsi legacy e alle campagne non abilitate.
I backup completi rimangono locali, esclusi da Git. La pubblicazione GitHub Pages
richiede ancora la configurazione descritta sotto.

Il nuovo progetto predisposto è **mercante-errante-dd-2026**, dell’account Google del proprietario.
I metadati Web pubblici sono in `config/firebase.web.json`. La chiave viene letta
dalla variabile `FIREBASE_WEB_API_KEY`; `js/firebase-config.js` viene generato da Vite
in sviluppo e durante la build, senza essere versionato. Nessun token CLI,
refresh token o account di servizio viene salvato nel repository.

L’accesso usa **Firebase Authentication email/password**, con alias interni
`<username>@dd.local`; nell’interfaccia continui a inserire solo username e password.
L’account admin è una vera identità Firebase separata dai quattro membri del party.
Le password non sono memorizzate in Realtime Database e non vengono confrontate
nel browser. Per le nuove password Firebase richiede almeno 6 caratteri.

`users/<nome>` contiene solo profilo e privilegi; `userAccess/<uid>` collega
l’identità Auth al nome. Le regole server impediscono l’accesso agli utenti non
abilitati o rimossi e impediscono ai player di assegnarsi privilegi amministrativi.
L’admin può aggiungere, rimuovere e riattivare un giocatore; rimuoverlo conserva
i contenuti personali ma revoca l’accesso al database.

Il database è in `europe-west1`. Il piano di migrazione mantiene libri, oggetti, bestiario,
NPC e gli altri contenuti; pet e schede PG sono vuoti. Le mappe/worldbuilding dei
vecchi account rimangono in `state/legacyUserContent`, accessibile agli amministratori.
Il vecchio progetto non è stato eliminato o riconfigurato.

Per distribuire configurazione Auth e regole sul progetto nuovo:

```sh
npx -y firebase-tools@latest deploy --only auth,database --project mercante-errante-dd-2026
```

Il reset legacy che scriveva password nel database è stato rimosso. I backup locali
rimangono esclusi da Git in `work/`.

### Sorgenti e build

Richiede Node.js 24.12 o successivo, coerente con gli strumenti di test Firebase.

I file canonici sono in `js/`, `css/`, `data/`, `img/`, `audio/` e `schede/`.
Anche i vecchi URL dei JSON e delle schede vengono generati da queste sorgenti,
senza ulteriori copie da modificare. Non esiste più una seconda copia in `public/`. Vite serve direttamente
questi sorgenti in sviluppo; il plugin `scripts/static-assets.mjs` include le
risorse in `dist/`. Vite compila entrambe le pagine, `index.html` e `admin.html`.

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

Tutti i contenuti si trovano nella cartella `data/` e **ogni nuovo elemento eredita automaticamente il nuovo stile, il bagliore di rarità e le animazioni 3D**.

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

- **Cerimonia di Login ("Portale Runico & Doppio Battente")**: definita in `js/ui/account-panel.js` (`playLoginPortalCeremony`) e in `css/animations.css` (`.sium-login-portal`, `.portal-door-left`, `.portal-door-right`). Non usa più alcuna esplosione di luce bianca.
- **Arena Dadi 3D Poliedrica**: nella sezione **Lanciatore Dadi** (`renderDadi` in `js/features/dice.js` + `build3DDieElement` in `js/animations.js`) tutti i dadi (`d4, d6, d8, d10, d12, d20, d100`) vengono lanciati in 3D con rimbalzo fisico, ombra dinamica sul velluto e onda d'urto runica all'impatto.
- **Transizioni al Click sulle Sezioni**: ogni volta che clicchi su una sezione del menu laterale, compare l'**Araldo Runico** della sezione (`SECTION_HERALDS` in `js/animations.js`), la pagina si srotola in 3D (`siumSectionUnroll3D`) e tutti gli elementi entrano con animazione scaglionata (`sium-reveal`).
- **Pulsante Rapido `✦ FX ON / OFF`**: presente nella barra in alto a destra e nel footer della sidebar per disattivare gli effetti pesanti su dispositivi lenti.

### Manutenzione

- La gestione account, privilegi, presenza e listener è in `js/users.js`; `js/party-admin.js` gestisce l’interfaccia di amministrazione.
- `render()` e `renderMain()` condividono lo stesso instradamento delle sezioni e la pulizia dei listener.
- Il sito usa JavaScript e CSS statici; il vecchio scaffold React/SSR e le relative dipendenze sono stati rimossi.
- `npm test` controlla dati, login, revoca degli account, persistenza e pulizia dei listener.
- `npm run test:browsers` verifica Chromium, Firefox/Gecko e WebKit con Firebase simulato, senza contattare il database reale. Per installare i browser: `npx playwright install --with-deps chromium firefox webkit`.
- I test browser usano una chiave fittizia e `dist-test/`, anche con il percorso GitHub Pages `/D-D/`. Coprono utenti, navigazione, negozi, temi, mappe, sette sistemi di schede e IndexedDB.
- I target di compilazione sono Chrome/Chromium 109+, Firefox 115+ e Safari 16.4+. I test eseguono le versioni dei tre motori fornite da Playwright; non sostituiscono una prova su ogni versione storica.
- `npm run format` e `npm run format:check` mantengono una formattazione uniforme dei sorgenti scritti a mano.
- I salvataggi locali ravvicinati vengono raggruppati; cambio scheda e chiusura forzano il salvataggio finale. IndexedDB riusa una connessione e conferma le scritture a transazione completata.
- Il motore delle mappe viene caricato dal sito solo quando serve. Le immagini delle card usano caricamento differito e decodifica asincrona; gli effetti si fermano a pagina nascosta e rispettano le preferenze di movimento ridotto.
- Le espressioni di autorizzazione RTDB si mantengono in `scripts/build-database-rules.mjs`. `npm run rules:build` rigenera `database.rules.json`; il deploy Firebase lo esegue automaticamente.

### Configurazione e alert sulle chiavi

Impostare `FIREBASE_WEB_API_KEY` in `.env.local` per lo sviluppo e nell’ambiente
della piattaforma che esegue la build per la produzione. La build si interrompe
se la variabile manca; non usa chiavi predefinite o valori codificati nel sorgente.
La configurazione generata resta visibile al browser, come richiesto dall’SDK Web
Firebase: la protezione dei dati dipende da Authentication, regole server e
restrizioni della chiave sui servizi Google consentiti.

La chiave del nuovo progetto segnalata in `js/firebase-config.js` è stata sostituita
e revocata. La nuova chiave è limitata a Identity Toolkit, Secure Token e Realtime
Database. Il codice usa solo il nuovo progetto: la vecchia chiave e il vecchio
endpoint sono assenti dai sorgenti dell’applicazione. La chiave sostitutiva rimane
nel file locale ignorato o nell’ambiente di build, senza essere inviata al repository.
L’account collegato non ha permessi sul vecchio progetto `mercante-errante`:
la relativa chiave storica deve essere revocata dal suo proprietario in Google Cloud.

La rimozione di un valore dal commit corrente non elimina un alert storico di
GitHub. Dopo la revoca, risolvere l’alert con motivo **Revoked**. L’integrazione
GitHub attuale non dispone dei permessi per leggere o modificare questi alert.
Non è stata riscritta la cronologia Git.

`npm run check:secrets` controlla tutti i file di testo versionabili, inclusi quelli
senza estensione, e il contenuto preparato per il commit nell’indice Git. Blocca
anche i file `.env` reali e la configurazione Firebase generata se vengono aggiunti
forzatamente a Git; `.env.example` contiene solo nomi senza valori. Stampa percorso,
numero di riga e tipo di problema, senza ripetere i valori trovati.
Viene eseguito automaticamente prima della build e nelle verifiche
GitHub Actions. Le verifiche CI usano una chiave fittizia e non pubblicano gli
artefatti generati; non richiedono credenziali reali. La build da distribuire deve
ricevere `FIREBASE_WEB_API_KEY` dall’ambiente della piattaforma di pubblicazione.
Il valore della nuova chiave è disponibile in Google Cloud, progetto
`mercante-errante-dd-2026`, Credenziali, **Mercante Errante browser runtime**.

Per il sito GitHub Pages, la pubblicazione diretta del ramo `main` non esegue Vite
e non genera la configurazione Firebase. Il workflow **Publish GitHub Pages**
pubblica invece `dist/` con il percorso `/D-D/` corretto:

1. In **Settings → Secrets and variables → Actions**, aggiungere il repository
   secret `FIREBASE_WEB_API_KEY` con il valore della chiave sostitutiva.
2. In **Settings → Pages → Build and deployment → Source**, scegliere **GitHub Actions**.
3. In **Actions → Publish GitHub Pages → Run workflow**, avviare la pubblicazione.

Il workflow si avvia manualmente, interrompe la build se manca il secret e non
scrive mai il valore nei sorgenti o nei log. L’artefatto pubblicato contiene la
configurazione Web, leggibile dal browser come ogni applicazione Firebase Web.
L’integrazione GitHub della sessione non ha i permessi per impostare i secret.

La build compatta JSON e JavaScript, mantenendo nomi globali, proprietà, nomi delle
funzioni e URL compatibili. I sorgenti restano leggibili e i file multimediali
conservano i contenuti originali.
