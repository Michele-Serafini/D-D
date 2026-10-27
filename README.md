# ⚜ Mercante Errante — Compendium & VTT per D&D (Redesign Completo)

Benvenuto nella versione completamente ridisegnata, animata e riorganizzata del tuo sito per **Dungeons & Dragons**. Tutti i dati, le 15 sezioni, i 522 oggetti dell'Emporio, i 398 incantesimi, i 365 mostri del Bestiario, i 6 NPC, le 34 tracce audio, le 60 illustrazioni e le 7 tipologie di schede personaggio (D&D 5e, 7th Sea, One Piece, Brancalonia, Star Wars 5e, Pokémon, Naruto) sono stati preservati al 100% e separati in una struttura pulita e facilissima da modificare.

---

## 📁 Struttura delle Cartelle

```text
├── index.html                  # Struttura HTML principale (pulita e leggera)
├── README.md                   # Questa guida rapida
├── css/
│   ├── variables.css           # ⭐ TUTTI i colori, font, spaziature e parametri animazioni
│   ├── theme.css               # Stile grafico moderno (card, bottoni, sidebar, rarità)
│   ├── animations.css          # ⭐ Portale Login, Dadi 3D, Araldo Sezioni, 3D Tilt e particelle
│   └── legacy.css              # Stili specifici dei widget complessi (pentacoli, mappe, schede)
├── data/
│   ├── catalog-data.js         # ⭐ Oggetti (522), Incantesimi (398), Bestiario (365), NPC (6)
│   ├── world-data.js           # ⭐ Eventi del Caos, Libri, Nomi NPC, Tracce Regia Sonora
│   ├── database_armi.json      # Backup JSON originale delle armi/oggetti
│   ├── database_bestiario.json # Backup JSON originale dei mostri custom
│   └── database_npc.json       # Backup JSON originale degli NPC
├── js/
│   ├── users.js                # ⭐ SISTEMA UTENTI UNIFICATO (Account, Ruoli, Login, Impostazioni)
│   ├── app.js                  # Logica applicativa suddivisa in 15 sezioni commentate + Dadi 3D
│   ├── animations.js           # ⭐ Motore Particelle, Dadi Poliedrici 3D, Araldo Sezioni, Tilt 3D
│   └── sheets/                 # Schede personaggio multi-sistema
│       ├── brancalonia.js
│       ├── sw5e.js
│       ├── pokemon.js
│       └── naruto.js
├── img/                        # Tutte le 60 immagini di oggetti, armi e sfondi login
├── audio/                      # Tutte le 34 tracce MP3 per la Regia Sonora e il Bardo
└── schede/                     # Tutte le 12 immagini di sfondo per le schede PG
```

---

## 👤 1. Account e amministrazione

Il database Firebase è l'unica fonte autorevole per gli account. `DEFAULT_USERS`
in `js/users.js` contiene solo i profili iniziali per icone e titoli. Non contiene
password, non ricrea gli utenti rimossi e non offre un accesso alternativo a Firebase Auth.

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

**Stato operativo:** il codice su `main` punta al nuovo progetto e gli utenti Auth sono già creati. Importazione dei contenuti e pubblicazione delle regole RTDB restano da completare: il relativo endpoint restituisce timeout/HTTP 500 da questo ambiente. Il merge del codice non conferma la migrazione del database remoto.

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

I file canonici sono in `js/`, `css/`, `data/`, `img/`, `audio/` e `schede/`.
Anche i vecchi URL dei JSON e delle schede vengono generati da queste sorgenti,
senza ulteriori copie da modificare. Non esiste più una seconda copia in `public/`. Vite serve direttamente
questi sorgenti in sviluppo; il plugin `scripts/static-assets.mjs` include gli
stessi file in `dist/`, compresa `admin.html`.

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

- **Cerimonia di Login ("Portale Runico & Doppio Battente")**: definita in `js/users.js` (`playLoginPortalCeremony`) e in `css/animations.css` (`.sium-login-portal`, `.portal-door-left`, `.portal-door-right`). Non usa più alcuna esplosione di luce bianca.
- **Arena Dadi 3D Poliedrica**: nella sezione **Lanciatore Dadi** (`renderDadi` in `js/app.js` + `build3DDieElement` in `js/animations.js`) tutti i dadi (`d4, d6, d8, d10, d12, d20, d100`) vengono lanciati in 3D con rimbalzo fisico, ombra dinamica sul velluto e onda d'urto runica all'impatto.
- **Transizioni al Click sulle Sezioni**: ogni volta che clicchi su una sezione del menu laterale, compare l'**Araldo Runico** della sezione (`SECTION_HERALDS` in `js/animations.js`), la pagina si srotola in 3D (`siumSectionUnroll3D`) e tutti gli elementi entrano con animazione scaglionata (`sium-reveal`).
- **Pulsante Rapido `✦ FX ON / OFF`**: presente nella barra in alto a destra e nel footer della sidebar per disattivare gli effetti pesanti su dispositivi lenti.

### Manutenzione

- La gestione account, privilegi, presenza e listener è in `js/users.js`; `js/party-admin.js` gestisce l’interfaccia di amministrazione.
- `render()` e `renderMain()` condividono lo stesso instradamento delle sezioni e la pulizia dei listener.
- Il sito usa JavaScript e CSS statici; il vecchio scaffold React/SSR e le relative dipendenze sono stati rimossi.
- `npm test` include anche i controlli TypeScript sui contenuti.
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

La build compatta JSON e JavaScript, mantenendo nomi globali, proprietà, nomi delle
funzioni e URL compatibili. I sorgenti restano leggibili e i file multimediali
conservano i contenuti originali.
