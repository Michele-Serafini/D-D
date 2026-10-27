/* ================================================================
   ENGINE AI — Groq primario (1-2s), Gemini fallback
   Groq usa LPU hardware dedicato: 10-50x più veloce di Gemini free
   ================================================================ */

var GROQ_MODELS = ['llama-3.1-8b-instant', 'llama-3.2-3b-preview', 'llama3-8b-8192'];
var GEMINI_MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-8b'];

/* Chiamata Groq — API OpenAI-compatible, risposta in 1-2s */
async function callGroq(modelName, key, systemPrompt, userPrompt) {
  var controller = new AbortController();
  var tid = setTimeout(function () {
    controller.abort();
  }, 7000);
  var resp;
  try {
    resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 700,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (e) {
    clearTimeout(tid);
    throw new Error('FALLBACK:timeout');
  }
  clearTimeout(tid);
  if (resp.status === 429) throw new Error('FALLBACK:429');
  if (!resp.ok) {
    var ed = null;
    try {
      ed = await resp.json();
    } catch (x) {}
    var m = ed && ed.error ? ed.error.message || '' : 'HTTP ' + resp.status;
    if (/rate|limit|quota|overload/i.test(m)) throw new Error('FALLBACK:demand');
    throw new Error(m || 'HTTP ' + resp.status);
  }
  var d = await resp.json();
  var raw = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
  if (!raw) throw new Error('Risposta vuota Groq.');
  return raw;
}

/* Chiamata Gemini */
async function callGemini(modelName, key, systemPrompt, userPrompt) {
  var url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    modelName +
    ':generateContent?key=' +
    encodeURIComponent(key);
  var controller = new AbortController();
  var tid = setTimeout(function () {
    controller.abort();
  }, 8000);
  var resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 700 },
      }),
    });
  } catch (e) {
    clearTimeout(tid);
    throw new Error('FALLBACK:timeout');
  }
  clearTimeout(tid);
  if (resp.status === 429 || resp.status === 503) throw new Error('FALLBACK:' + resp.status);
  if (!resp.ok) {
    var ed = null;
    try {
      ed = await resp.json();
    } catch (x) {}
    var m = ed && ed.error && ed.error.message ? ed.error.message : 'HTTP ' + resp.status;
    if (/high demand|overload|quota|unavailable/i.test(m)) throw new Error('FALLBACK:demand');
    throw new Error(m);
  }
  var d = await resp.json();
  var raw =
    d.candidates &&
    d.candidates[0] &&
    d.candidates[0].content &&
    d.candidates[0].content.parts &&
    d.candidates[0].content.parts[0]
      ? d.candidates[0].content.parts[0].text
      : null;
  if (!raw) throw new Error('Risposta vuota Gemini.');
  return raw;
}

/* Motore unificato: Groq prima (se chiave presente), poi Gemini */
async function callAI(systemPrompt, userPrompt) {
  var lastGroqErr = null;

  /* --- GROQ (primario, velocissimo) --- */
  if (state.groqKey && state.groqKey.trim()) {
    for (var gi = 0; gi < GROQ_MODELS.length; gi++) {
      try {
        var raw = await callGroq(GROQ_MODELS[gi], state.groqKey, systemPrompt, userPrompt);
        return { raw: raw, engine: 'Groq/' + GROQ_MODELS[gi] };
      } catch (err) {
        lastGroqErr = err;
        /* Continua sempre al prossimo modello Groq, qualunque sia l'errore */
        continue;
      }
    }
    /* Se tutti i modelli Groq falliscono: avvisa e vai a Gemini */
    if (lastGroqErr) {
      var isKeyErr = /invalid|unauthorized|auth|key|forbidden/i.test(lastGroqErr.message);
      if (isKeyErr) {
        /* Chiave Groq sbagliata — non perdere tempo, vai subito a Gemini */
        notify('\u26A0 Chiave Groq non valida, uso Gemini...');
      }
    }
  }

  /* --- GEMINI (fallback) --- */
  if (state.geminiKey && state.geminiKey.trim()) {
    for (var mi = 0; mi < GEMINI_MODELS.length; mi++) {
      try {
        var raw = await callGemini(GEMINI_MODELS[mi], state.geminiKey, systemPrompt, userPrompt);
        return { raw: raw, engine: 'Gemini/' + GEMINI_MODELS[mi] };
      } catch (err) {
        /* Continua sempre al prossimo modello Gemini */
        continue;
      }
    }
  }

  throw new Error('Tutti i modelli AI hanno fallito. Controlla le chiavi API e la connessione.');
}

/* Compatibilità con generaItemInBackground */
async function callGeminiModel(modelName, key, systemPrompt, userPrompt) {
  return callGemini(modelName, key, systemPrompt, userPrompt);
}
