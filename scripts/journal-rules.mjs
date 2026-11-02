// Masters read the private journal. Players can append only their own saved rolls.
export function journalRules({ master, member, actor, campaign }) {
  const journal = `${campaign}.child('data').child('sessionJournal')`;
  const meta = `${journal}.child('control').child('sessions').child($session)`;
  const roll =
    "newData.parent().parent().parent().parent().child('diceRolls').child(newData.child('sourceId').val())";
  const mine = `newData.child('author').val() === (${actor})`;
  const checkpoint = `(${master}) && ((newData.parent().child('kind').val() === 'checkpoint' && $event === 'notes_' + (${actor})) || (newData.parent().child('kind').val() === 'combat' && $event === 'combat_' + newData.parent().child('sourceId').val() + '_checkpoint'))`;
  const immutable = `!data.exists() || newData.val() === data.val() || (${checkpoint})`;
  const source = `${roll}.child('username').val() === (${actor}) && ${roll}.child('sessionId').val() === $session && ${roll}.child('occurredAt').val() === newData.child('at').val() && ${roll}.child('value').val() === newData.child('value').val() && ${roll}.child('diceType').val() === newData.child('diceType').val() && (${roll}.child('important').val() === true || ${roll}.child('critical').val() === true || ${roll}.child('failure').val() === true)`;
  return {
    '.read': master,
    '.write': master,
    control: {
      active: {
        '.read': member,
        '.validate':
          "newData.isString() && newData.parent().child('sessions').child(newData.val()).exists()",
      },
      sessions: {
        $session: {
          '.validate': "newData.hasChildren(['title','startedAt','createdBy'])",
          title: {
            '.validate':
              'newData.isString() && newData.val().length > 0 && newData.val().length <= 100 && (!data.exists() || newData.val() === data.val())',
          },
          startedAt: {
            '.validate':
              'newData.isNumber() && newData.val() > 0 && (!data.exists() || newData.val() === data.val())',
          },
          endedAt: {
            '.validate':
              "newData.isNumber() && newData.val() >= newData.parent().child('startedAt').val() && (!data.exists() || newData.val() === data.val())",
          },
          createdBy: {
            '.validate': `newData.isString() && (data.exists() ? newData.val() === data.val() : newData.val() === (${actor}))`,
          },
          $other: { '.validate': false },
        },
      },
      $other: { '.validate': false },
    },
    events: {
      $session: {
        '.indexOn': ['at'],
        $event: {
          '.write': `(${member}) && newData.exists() && (${mine}) && newData.child('kind').val() === 'roll' && $event === 'roll_' + newData.child('sourceId').val() && ((data.exists() && data.child('author').val() === (${actor})) || (${source}))`,
          '.validate': `newData.hasChildren(['id','kind','title','body','author','at','sourceId']) && ${meta}.exists() && (${mine}) && (newData.child('kind').val() !== 'roll' || (newData.child('at').val() >= ${meta}.child('startedAt').val() && (!${meta}.child('endedAt').exists() || newData.child('at').val() <= ${meta}.child('endedAt').val()) && (data.exists() || (${source})))) && (!data.exists() || newData.child('at').val() >= data.child('at').val())`,
          id: {
            '.validate':
              'newData.val() === $event && newData.isString() && newData.val().length <= 300',
          },
          kind: {
            '.validate': `(newData.val() === 'roll' || newData.val() === 'combat' || newData.val() === 'reward' || newData.val() === 'note' || newData.val() === 'checkpoint') && (${immutable})`,
          },
          title: {
            '.validate': `newData.isString() && newData.val().length <= 160 && (${immutable})`,
          },
          body: {
            '.validate': `newData.isString() && newData.val().length <= 50000 && (${immutable})`,
          },
          author: { '.validate': `newData.isString() && (${immutable})` },
          at: { '.validate': `newData.isNumber() && newData.val() > 0 && (${immutable})` },
          sourceId: {
            '.validate': `newData.isString() && newData.val().length <= 300 && (${immutable})`,
          },
          value: { '.validate': `newData.isNumber() && (${immutable})` },
          diceType: {
            '.validate': `newData.isNumber() && newData.val() >= 1 && newData.val() <= 1000 && (${immutable})`,
          },
          $other: { '.validate': false },
        },
      },
    },
    drafts: {
      $session: {
        '.validate': `${meta}.exists() && newData.hasChildren(['text','updatedBy','updatedAt'])`,
        text: { '.validate': 'newData.isString() && newData.val().length <= 200000' },
        updatedBy: { '.validate': `newData.val() === (${actor})` },
        updatedAt: { '.validate': 'newData.isNumber() && newData.val() > 0' },
        $other: { '.validate': false },
      },
    },
    $other: { '.validate': false },
  };
}
