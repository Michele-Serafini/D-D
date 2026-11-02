/* Session events and deterministic recaps; no external AI or credentials required. */
var JournalModel = (function () {
  function event(id, kind, title, body, author, at, sourceId) {
    return {
      id: id,
      kind: kind,
      title: String(title).slice(0, 160),
      body: String(body).slice(0, 50000),
      author: author,
      at: at,
      sourceId: sourceId || id,
    };
  }
  function roll(id, data) {
    if (!data.important && !data.critical && !data.failure) return null;
    var label = data.critical ? '20 naturale' : data.failure ? '1 naturale' : 'Tiro importante';
    return Object.assign(
      event(
        'roll_' + id,
        'roll',
        label + ' · ' + data.username,
        (data.formula || 'd' + data.diceType) +
          ': ' +
          (data.rolls || []).join(', ') +
          ' → totale ' +
          data.value +
          (data.mode ? ' · ' + data.mode : ''),
        data.username,
        data.occurredAt,
        id
      ),
      { value: data.value, diceType: data.diceType }
    );
  }
  function reward(username, characterId, operationId, operation, receipt, name) {
    var source = [username, characterId, operationId]
      .map(function (part) {
        return part.length + '_' + part;
      })
      .join('_');
    var parts = [];
    if (operation.item) parts.push(operation.quantity + ' × ' + operation.item.name);
    if (operation.coins) parts.push(operation.coins + ' ' + operation.currency);
    return event(
      'reward_' + source,
      'reward',
      'Ricompensa · ' + (name || username),
      parts.join(', ') + (operation.label ? '\n' + operation.label : ''),
      receipt.actor,
      receipt.at,
      source
    );
  }
  function combat(encounter, phase, combatants, round, author, at) {
    var labels = {
      start: 'Combattimento iniziato',
      end: 'Combattimento concluso',
      checkpoint: 'Combattimento in corso',
    };
    var participants = combatants
      .filter(function (c) {
        return c.nome && c.nome.trim();
      })
      .map(function (c) {
        return (
          c.nome +
          (c.hp !== '' && c.hp != null ? ' · ' + c.hp + ' PF' : '') +
          (c.condizioni && c.condizioni.length ? ' · ' + c.condizioni.join(', ') : '')
        );
      });
    return event(
      'combat_' + encounter.id + '_' + phase,
      'combat',
      labels[phase],
      'Round ' + round + '\n' + participants.join('\n'),
      author,
      at,
      encounter.id
    );
  }
  function ordered(events) {
    return Object.values(events || {})
      .filter(Boolean)
      .sort(function (a, b) {
        return a.at - b.at || a.id.localeCompare(b.id);
      });
  }
  function recap(meta, events) {
    var entries = ordered(events),
      fights = new Map();
    entries
      .filter(function (entry) {
        return entry.kind === 'combat';
      })
      .forEach(function (entry) {
        var previous = fights.get(entry.sourceId);
        var rank = function (item) {
          return item.id.endsWith('_end') ? 3 : item.id.endsWith('_checkpoint') ? 2 : 1;
        };
        if (!previous || rank(entry) >= rank(previous)) fights.set(entry.sourceId, entry);
      });
    var groups = [
      ['Combattimenti', Array.from(fights.values())],
      [
        'Tiri importanti',
        entries.filter(function (entry) {
          return entry.kind === 'roll';
        }),
      ],
      [
        'Ricompense',
        entries.filter(function (entry) {
          return entry.kind === 'reward';
        }),
      ],
      [
        'Appunti del master',
        entries.filter(function (entry) {
          return entry.kind === 'note' || entry.kind === 'checkpoint';
        }),
      ],
    ];
    var lines = [
      '# ' + meta.title,
      '',
      'Sessione del ' + new Date(meta.startedAt).toLocaleDateString('it-IT'),
      '',
    ];
    groups.forEach(function (group) {
      if (!group[1].length) return;
      lines.push('## ' + group[0], '');
      group[1].forEach(function (entry) {
        lines.push('### ' + entry.title, '', entry.body, '');
      });
    });
    if (!entries.length)
      lines.push('Nessun evento registrato. Aggiungi qui il riepilogo della sessione.');
    return lines.join('\n');
  }
  return {
    event: event,
    roll: roll,
    reward: reward,
    combat: combat,
    ordered: ordered,
    recap: recap,
  };
})();
