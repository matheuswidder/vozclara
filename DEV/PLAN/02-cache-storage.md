# Parte 2 — Poda do cache de transcrições (estouro do `chrome.storage.local`)

**Resolve**: A1 (crítico latente).

**Depende de**: nada. **Antes da**: Parte 5 (mesmo `background.js` — fazer o
try/catch do `set` primeiro).

## Problema atual

- `background.js:1307`: todo resultado é salvo para sempre em
  `tx:<sha24>:<provider>:<kind>:<lang>` via `chrome.storage.local.set`.
- `chrome.storage.local` tem cota de **10 485 760 bytes (10 MB)** desde o
  Chrome 114. Não há `unlimitedStorage` no `manifest.json` — e **não deve
  haver**. A cota conta `JSON.stringify(value).length + key.length`.
- Quando estoura, `set()` **rejeita a Promise** depois da transcrição OK.
  `transcribe()` lança → `background.js:72-78` responde
  `{ ok: false, error: "Falha ao transcrever." }`.

## Decisão de schema (obrigatória — não improvisar)

**Não mudar a chave.** Continua `tx:<sha24>:<provider>:<kind>:<lang>` para o
hit atual (`background.js:1246-1249`).

**Valor novo**: `{ t: Date.now(), text: string }`.

**Leitura** (hit e prune):

```js
function txText(value) {
  if (typeof value === "string") return value;          // legado
  if (value && typeof value.text === "string") return value.text;
  return "";
}
function txTime(value) {
  if (value && typeof value.t === "number") return value.t;
  return 0; // legado sem timestamp: sai primeiro na poda
}
```

Hit: `const text = txText(cached[cacheKey]); if (text) return { ok: true, text, provider, cached: true };`

Não gravar timestamp na chave. Não usar `parseTsFromKey`.

## Implementação

### 2.1 Salvar sem quebrar

**Arquivo**: `extension/background.js` (função `transcribe`, final)

```js
try {
  await chrome.storage.local.set({ [cacheKey]: { t: Date.now(), text } });
} catch {
  await pruneCache().catch(() => {});
  try {
    await chrome.storage.local.set({ [cacheKey]: { t: Date.now(), text } });
  } catch {
    /* segue sem cache — transcrição já está OK */
  }
}
return { ok: true, text, provider };
```

**Regra de ouro**: falha de cache nunca transforma transcrição OK em erro.

### 2.2 Poda LRU por `t`

**Arquivo**: `extension/background.js` (função de nível de módulo — o SW
clássico expõe no global; o console do service worker consegue chamar
`pruneCache()` direto).

```js
const TX_PREFIX = "tx:";
const TX_KEEP = 200;

async function pruneCache() {
  const all = await chrome.storage.local.get(null);
  const entries = Object.keys(all)
    .filter((k) => k.startsWith(TX_PREFIX))
    .map((k) => ({ k, ts: txTime(all[k]) }));
  entries.sort((a, b) => b.ts - a.ts);
  const excess = entries.slice(TX_KEEP).map((e) => e.k);
  if (excess.length) await chrome.storage.local.remove(excess);
}
```

- Chamar também em `chrome.runtime.onStartup` (junto com `verifyModel`).
- Não chamar a cada transcrição — só no catch de cota e no startup.
- `get(null)` puxa apiKey e o resto: filtrar pelo prefixo `tx:` na hora de
  apagar. Não apagar outras chaves.

## Critérios de aceite

- [ ] Transcrição OK permanece `ok: true` com storage cheio.
- [ ] Depois de `pruneCache()`, no máximo `TX_KEEP` chaves `tx:*`.
- [ ] Mesmo áudio + mesmo provedor/idioma ainda dá cache hit (string legado
      e objeto `{t,text}`).
- [ ] Chave **não** ganhou timestamp no meio.

## Verificação (dois testes distintos)

1. **Contagem (não é cota):** no console do service worker da extensão,
   gravar 250 chaves `tx:fake-N:local:turbo:pt` com `{ t: Date.now()-N, text: "x" }`,
   chamar `await pruneCache()`, contar `tx:*` ≤ 200.
2. **Hit:** transcrever o mesmo áudio duas vezes → a segunda é instantânea
   (`cached: true` no response, se logar).
3. **Cota de verdade (~10 MB), não 250 strings:** no SW,
   `await chrome.storage.local.set({ _fill: "a".repeat(9_000_000) })`
   (ajustar até o próximo `set` de `tx:*` rejeitar). Transcrever. A UI **não**
   pode mostrar “Falha ao transcrever”. Remover `_fill` no fim.
