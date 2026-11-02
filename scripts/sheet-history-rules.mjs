// Head CAS serializes edits; immutable deltas and source revision commit together.
export function sheetHistoryRules({ master, owner, actor, campaign }) {
  const access = `(${master}) || (${owner})`;
  const oldHead = `${campaign}.child('data').child('sheetHistory').child($name).child($character).child('head')`;
  const dataAtHead = 'newData.parent().parent().parent().parent()';
  const nextSheet = `${dataAtHead}.child('schedePG').child($name).child('chars').child($character)`;
  const entry = "newData.parent().child('entries').child(newData.child('revision').val())";
  const headAtEntry = "newData.parent().parent().child('head')";
  const shape = {
    version: { '.validate': 'newData.isNumber() && newData.val() >= 1 && newData.val() % 1 === 0' },
    actor: { '.validate': `newData.val() === (${actor})` },
    at: { '.validate': 'newData.isNumber() && newData.val() > 0 && newData.val() <= now + 300000' },
  };
  const history = {
    '.read': master,
    $name: {
      '.read': owner,
      $character: {
        head: {
          '.write': `(${access}) && newData.exists()`,
          '.validate': `newData.hasChildren(['version','revision','actor','at','name']) && newData.child('version').val() === (data.exists() ? data.child('version').val() : 0) + 1 && ${nextSheet}.child('_rev').val() === newData.child('revision').val() && ${entry}.child('version').val() === newData.child('version').val() && ${entry}.child('actor').val() === newData.child('actor').val() && ${entry}.child('at').val() === newData.child('at').val()`,
          ...shape,
          revision: {
            '.validate':
              "newData.isString() && newData.val().length <= 100 && !data.parent().parent().child('entries').child(newData.val()).exists()",
          },
          name: { '.validate': 'newData.isString() && newData.val().length <= 160' },
          $other: { '.validate': false },
        },
        entries: {
          '.indexOn': ['version'],
          $revision: {
            '.write': `(${access}) && !data.exists() && newData.exists()`,
            '.validate': `!data.exists() && newData.hasChildren(['version','actor','at','kind','before','after','source']) && ${headAtEntry}.child('revision').val() === $revision && ${headAtEntry}.child('version').val() === newData.child('version').val() && ${headAtEntry}.child('actor').val() === newData.child('actor').val() && ${headAtEntry}.child('at').val() === newData.child('at').val()`,
            ...shape,
            kind: {
              '.validate':
                "newData.val() === 'create' || newData.val() === 'edit' || newData.val() === 'restore' || newData.val() === 'purchase' || newData.val() === 'reward'",
            },
            before: { '.validate': 'newData.isString() && newData.val().length <= 8000000' },
            after: { '.validate': 'newData.isString() && newData.val().length <= 8000000' },
            source: { '.validate': 'newData.isString() && newData.val().length <= 100' },
            $other: { '.validate': false },
          },
        },
        $other: { '.validate': false },
      },
    },
  };
  const newHead =
    "newData.parent().parent().parent().parent().child('sheetHistory').child($name).child($character).child('head')";
  // Existing clients remain usable until this character first enters the audit.
  const guard = `(!data.child('_rev').exists() && !newData.child('_rev').exists() && !${oldHead}.exists()) || (${newHead}.child('revision').val() === newData.child('_rev').val() && ${newHead}.child('version').val() === (${oldHead}.exists() ? ${oldHead}.child('version').val() : 0) + 1)`;
  return { history, guard };
}
