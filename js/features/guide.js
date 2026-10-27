// ═══════════════════════════════════════════════════════════════════
//  REGOLAMENTO
// ═══════════════════════════════════════════════════════════════════
function renderRegolamento() {
  var wrap = document.createElement('div');
  wrap.style.cssText = 'max-width:800px;margin:0 auto;padding:2rem 1rem 4rem;';

  function sec(title, icon) {
    var s = document.createElement('div');
    s.style.cssText =
      'margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid var(--border-subtle);';
    var h2 = document.createElement('div');
    h2.style.cssText =
      'font-family:Cinzel,serif;font-size:18px;font-weight:700;color:var(--gold);margin-bottom:1rem;display:flex;align-items:center;gap:0.6rem;';
    h2.innerHTML = '<span>' + icon + '</span><span>' + title + '</span>';
    s.appendChild(h2);
    return s;
  }
  function p(text) {
    var el = document.createElement('p');
    el.style.cssText =
      'font-family:EB Garamond,serif;font-size:16px;line-height:1.75;color:var(--text-main);margin:0.6rem 0;';
    el.innerHTML = text;
    return el;
  }
  function sub(text) {
    var el = document.createElement('div');
    el.style.cssText =
      'font-family:Cinzel,serif;font-size:12px;font-weight:700;color:var(--text-strong);margin:1.2rem 0 0.4rem;text-transform:uppercase;letter-spacing:0.08em;';
    el.textContent = text;
    return el;
  }
  function ul(items) {
    var l = document.createElement('ul');
    l.style.cssText =
      'font-family:EB Garamond,serif;font-size:16px;line-height:1.75;color:var(--text-main);padding-left:1.4rem;margin:0.4rem 0;';
    items.forEach(function (it) {
      var li = document.createElement('li');
      li.innerHTML = it;
      l.appendChild(li);
    });
    return l;
  }

  // Titolo
  var hero = document.createElement('div');
  hero.style.cssText = 'text-align:center;padding:2rem 0 1rem;';
  hero.innerHTML =
    '<div style="font-size:48px;margin-bottom:0.5rem;">📜</div>' +
    '<h1 style="font-family:Cinzel,serif;font-size:26px;font-weight:800;color:var(--gold);margin:0 0 0.5rem;">Regolamento</h1>' +
    '<div style="font-family:EB Garamond,serif;font-size:17px;color:var(--text-muted);">Guida completa al Mercante Errante</div>';
  wrap.appendChild(hero);

  // Cos’è
  var s0 = sec('Cos’è il Mercante Errante?', '🏰');
  s0.style.borderTop = 'none';
  s0.style.marginTop = '0';
  s0.style.paddingTop = '0';
  s0.appendChild(
    p(
      'Il <strong>Mercante Errante</strong> è un’app da tavolo per campagne di D&D 5e. Il DM gestisce la sessione, i giocatori (PG) si connettono tramite link. Tutto è sincronizzato in tempo reale via Firebase.'
    )
  );
  s0.appendChild(
    p(
      '<strong>Ruoli:</strong> <strong>Admin</strong> (modifica il catalogo globale), <strong>DM</strong> (gestisce sessioni e gruppi), <strong>PG</strong> (accede tramite link invito).'
    )
  );
  wrap.appendChild(s0);

  // Gruppi
  var sg = sec('Come creare e gestire un Gruppo', '⚔️');
  sg.appendChild(
    p(
      'Un <strong>Gruppo</strong> rappresenta una campagna. Bacheca, Iniziativa, Caos e Schede PG sono <strong>private per gruppo</strong>.'
    )
  );
  sg.appendChild(sub('Creare un gruppo (DM)'));
  sg.appendChild(
    ul([
      'Clicca <strong>"⚔️ Crea / Seleziona Gruppo"</strong> nella barra laterale o nelle Impostazioni.',
      'Inserisci il <strong>nome del gruppo</strong> (es. "Gli Eroi di Waterdeep") e premi <strong>"Crea Gruppo"</strong>.',
      'Il gruppo è salvato permanentemente: dura per tutta la campagna.',
      'Puoi avere più campagne e passare dall’una all’altra da "Gestisci Gruppo".',
    ])
  );
  sg.appendChild(sub('Invitare i giocatori (DM)'));
  sg.appendChild(
    ul([
      'Con un gruppo attivo, clicca <strong>"🔗 Copia Link Invito PG"</strong>.',
      'Il link viene copiato: mandalo ai giocatori (WhatsApp, Discord, ecc.).',
      'I PG aprono il link e inseriscono il nome del personaggio.',
    ])
  );
  sg.appendChild(sub('Riprendere una campagna (DM)'));
  sg.appendChild(
    ul([
      'Il gruppo si ricarica <strong>automaticamente</strong> al prossimo accesso con lo stesso account Google.',
      'Su un nuovo dispositivo: accedi con lo stesso account Google.',
      'Per cambiare campagna: apri "Gestisci Gruppo" e seleziona un’altra campagna.',
    ])
  );
  wrap.appendChild(sg);

  // Emporio
  var se = sec('Emporio', '🛒');
  se.appendChild(
    p(
      'Il negozio virtuale del DM con tutto l’equipaggiamento: armi medievali, oggetti magici, pozioni.'
    )
  );
  se.appendChild(
    ul([
      '<strong>Armi medievali e oggetti:</strong> spade, armature, scudi con prezzo in monete.',
      '<strong>Armi da fuoco:</strong> per ambientazioni moderne.',
      '<strong>Impianti Cibernetici:</strong> per campagne cyberpunk.',
      '<strong>Sostanze:</strong> droghe, veleni e pozioni con effetti e dipendenza.',
      '<strong>Veicoli:</strong> cavalli, carri, navi e inventario del party.',
    ])
  );
  se.appendChild(
    p(
      "L'<strong>Admin</strong> può aggiungere, modificare ed <strong>eliminare</strong> oggetti. Le eliminazioni sono permanenti."
    )
  );
  wrap.appendChild(se);

  // Bestiario
  var sb = sec('Bestiario', '🐉');
  sb.appendChild(
    p(
      'Contiene tutti i mostri del SRD 5.1. Ogni scheda mostra: PF, CA, velocità, caratteristiche, tratti speciali e azioni.'
    )
  );
  sb.appendChild(
    ul([
      'Usa la <strong>barra di ricerca</strong> e i <strong>filtri</strong> per trovare mostri per tipo o taglia.',
      'Clicca su un mostro per la scheda dettagliata.',
      'Il <strong>DM</strong> può aggiungere mostri personalizzati.',
      "L'<strong>Admin</strong> può eliminare mostri: non si ripristinano al ricaricamento.",
    ])
  );
  wrap.appendChild(sb);

  // Incantesimi
  var si = sec('Incantesimi', '✨');
  si.appendChild(
    p(
      'Lista completa degli incantesimi SRD divisi per livello, scuola di magia e classe. Il DM può aggiungere incantesimi homebrew.'
    )
  );
  wrap.appendChild(si);

  // Iniziativa
  var sini = sec('Iniziativa (privata per gruppo)', '⚡');
  sini.appendChild(
    p(
      'Tracker di iniziativa per il combattimento. Sincronizzato in tempo reale con tutto il gruppo.'
    )
  );
  sini.appendChild(
    ul([
      'Il DM aggiunge combattenti (PG e mostri) con nome, HP e iniziativa.',
      '<strong>"Avanza Turno"</strong> scorre i combattenti in ordine.',
      '<strong>Richiede un gruppo attivo.</strong>',
    ])
  );
  wrap.appendChild(sini);

  // Caos
  var sc = sec('Statistiche & Caos (privata per gruppo)', '🎲');
  sc.appendChild(
    p(
      'Tiene traccia dei successi (20 nat) e fallimenti (1 nat) critici di ogni giocatore e mostra la ruota del destino del party.'
    )
  );
  sc.appendChild(
    p(
      'La <strong>ruota del Doom</strong> accumula punti ad ogni fallimento: quando è piena accade qualcosa di brutto! Dati privati per gruppo.'
    )
  );
  wrap.appendChild(sc);

  // Bacheca
  var sbac = sec('Bacheca Ricercati (privata per gruppo)', '📋');
  sbac.appendChild(
    p(
      'Lavagna virtuale per immagini: PNG di mostri, mappe, NPC ricercati. Tutto sincronizzato in tempo reale con il gruppo.'
    )
  );
  sbac.appendChild(
    ul([
      'Carica immagini dal dispositivo o incolla un URL.',
      'Trascina per spostare, doppio click per girare, 🔍 per ingrandire.',
      'Il Pin fissa un’immagine così non si sposta per sbaglio.',
      '<strong>Richiede un gruppo attivo.</strong>',
    ])
  );
  wrap.appendChild(sbac);

  // Schede PG
  var ssch = sec('Schede PG (privata per gruppo)', '📄');
  ssch.appendChild(
    p(
      'I giocatori compilano la propria scheda personaggio tramite il link invito. Il DM vede le schede di tutti i PG del gruppo.'
    )
  );
  ssch.appendChild(
    ul([
      'La scheda include statistiche, inventario, incantesimi, tratti e biografie.',
      'Ogni PG vede e modifica solo la propria scheda.',
      'Privata per gruppo: gruppi diversi non si vedono.',
    ])
  );
  wrap.appendChild(ssch);

  // Altri strumenti
  var salt = sec('Altri strumenti', '📚');
  salt.appendChild(sub('Mappa del Mondo'));
  salt.appendChild(
    p(
      'Carica una mappa e posiziona segnalini per PG, NPC e luoghi. Condivisa tra tutti i gruppi del DM (fa parte del mondo, non della singola campagna).'
    )
  );
  salt.appendChild(sub('Generatore NPC'));
  salt.appendChild(
    p('Genera e gestisci personaggi non giocanti con caratteristiche, background e connessioni.')
  );
  salt.appendChild(sub('Worldbuilding & Storia'));
  salt.appendChild(
    p(
      '<strong>Worldbuilding:</strong> organizza il mondo in fazioni, zone e città. <strong>Storia:</strong> registro narrativo della campagna con sessioni ed eventi chiave.'
    )
  );
  salt.appendChild(sub('Lanciatore Dadi'));
  salt.appendChild(
    p(
      'Lancia d4, d6, d8, d10, d12, d20, d100 con animazione. I risultati sono visibili a tutti nel gruppo.'
    )
  );
  salt.appendChild(sub('Libreria'));
  salt.appendChild(
    p('Salva documenti di testo: regole homebrew, descrizioni di luoghi, note di sessione.')
  );
  wrap.appendChild(salt);

  // FAQ
  var sfaq = sec('Domande Frequenti', '❓');
  var faqs = [
    [
      'Il gruppo si perde se chiudo il browser?',
      'No. Il gruppo è salvato nel tuo account Firebase. Al prossimo accesso con lo stesso account Google viene ripristinato automaticamente.',
    ],
    [
      'Posso avere più campagne?',
      'Sì. Crea un gruppo per campagna. Passa da una all’altra con "Gestisci Gruppo".',
    ],
    [
      'I giocatori devono creare un account?',
      'No. I PG accedono solo col link invito e il nome del personaggio. Nessun account richiesto.',
    ],
    [
      'L’Admin può eliminare mostri e armi?',
      'Sì. I pulsanti di eliminazione sono visibili solo all’Admin. Le eliminazioni sono permanenti e non si ripristinano al ricaricamento.',
    ],
  ];
  faqs.forEach(function (f) {
    sfaq.appendChild(sub(f[0]));
    sfaq.appendChild(p(f[1]));
  });
  wrap.appendChild(sfaq);

  return wrap;
}
