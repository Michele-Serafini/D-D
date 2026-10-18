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

## 👤 1. Come Modificare o Aggiungere Utenti e Ruoli (`js/users.js`)

Tutta la gestione degli utenti, delle password, dei ruoli (`DM` vs `Giocatore`), del login e del pannello impostazioni è ora **unificata in un singolo file chiarissimo**: **`js/users.js`**.

Per aggiungere un nuovo amico al party o cambiare una password predefinita, apri `js/users.js` e modifica l'array `DEFAULT_USERS` in cima al file:

```javascript
var DEFAULT_USERS = [
  { username: 'Matteo',   password: 'Dungeonmaster!', role: 'DM',        dmPriv: true,  crest: '👑', title: 'Dungeon Master' },
  { username: 'Luca',     password: 'player1',        role: 'Giocatore', dmPriv: false, crest: '🛡', title: 'Avventuriero' },
  { username: 'Michele',  password: 'player2',        role: 'Giocatore', dmPriv: false, crest: '⚔', title: 'Avventuriero' },
  // Aggiungi qui nuovi utenti:
  { username: 'NuovoPG',  password: 'segreta',        role: 'Giocatore', dmPriv: false, crest: '🐉', title: 'Avventuriero' }
];
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
