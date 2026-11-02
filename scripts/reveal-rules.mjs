export function revealRules({ master, member, actor, campaign }) {
  const source = `${campaign}.child('data').child('secretContent').child($content)`;
  const types =
    "newData.val() === 'luogo' || newData.val() === 'npc' || newData.val() === 'immagine' || newData.val() === 'indizio'";
  const fields = {
    type: { '.validate': types },
    title: {
      '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 160',
    },
    text: { '.validate': 'newData.isString() && newData.val().length <= 20000' },
    image: {
      '.validate':
        "newData.isString() && newData.val().length <= 600000 && (newData.val() === '' || newData.val().matches(/^https:\\/\\/.+$/) || newData.val().matches(/^data:image\\/(png|jpeg|webp);base64,[a-zA-Z0-9+\\/=]+$/))",
    },
    revision: {
      '.validate': 'newData.isNumber() && newData.val() >= 1 && newData.val() % 1 === 0',
    },
  };
  return {
    secret: {
      '.read': master,
      $content: {
        '.write': master,
        '.validate':
          "newData.hasChildren(['type','title','text','image','masterNotes','revision','createdBy','createdAt','updatedBy','updatedAt']) && newData.child('revision').val() === (data.exists() ? data.child('revision').val() : 0) + 1 && (newData.child('type').val() !== 'immagine' || newData.child('image').val().length > 0)",
        ...fields,
        masterNotes: { '.validate': 'newData.isString() && newData.val().length <= 20000' },
        createdBy: {
          '.validate': `newData.isString() && (data.exists() ? newData.val() === data.val() : newData.val() === (${actor}))`,
        },
        createdAt: {
          '.validate':
            'newData.isNumber() && newData.val() > 0 && (!data.exists() || newData.val() === data.val())',
        },
        updatedBy: { '.validate': `newData.val() === (${actor})` },
        updatedAt: { '.validate': 'newData.isNumber() && newData.val() > 0' },
        $other: { '.validate': false },
      },
    },
    shared: {
      '.read': member,
      $content: {
        '.write': master,
        '.validate': `newData.hasChildren(['type','title','text','image','revision','revealedBy','revealedAt']) && ${source}.exists()`,
        ...Object.fromEntries(
          Object.entries(fields).map(([key, shape]) => [
            key,
            {
              '.validate': `(${shape['.validate']}) && newData.val() === ${source}.child('${key}').val()`,
            },
          ])
        ),
        revealedBy: { '.validate': `newData.val() === (${actor})` },
        revealedAt: { '.validate': 'newData.isNumber() && newData.val() > 0' },
        $other: { '.validate': false },
      },
    },
  };
}
