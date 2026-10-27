import accountPolicy from '../config/accounts.json' with { type: 'json' };

export function renderFirebaseConfig(metadata, apiKey) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('Imposta FIREBASE_WEB_API_KEY in .env.local o nell’ambiente di build.');
  }
  if (!metadata.projectId || !metadata.appId || !metadata.databaseURL) {
    throw new Error('Metadati Firebase incompleti in config/firebase.web.json.');
  }
  const config = { ...metadata, apiKey: apiKey.trim() };
  return `window.__FIREBASE_CONFIG__ = ${JSON.stringify(config)};\nwindow.__ACCOUNT_POLICY__ = ${JSON.stringify(accountPolicy)};\n`;
}
