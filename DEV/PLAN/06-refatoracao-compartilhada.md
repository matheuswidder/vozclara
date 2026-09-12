# Parte 6 — Unificar código duplicado popup/dock

**Resolve**: M7 (duplicação com divergência já presente).

**Depende de**: Partes 1 e 5 (senão o shared congela UI velha). **Antes da**:
Parte 7 (testes 7.7 importam `shared.js`).

## Problema atual

Copiados entre `popup.js` e `dock.js` (e `background.js` / `offscreen.js`):

- `normalizeKind` — `popup.js:1-9`, `dock.js:419-427`, `background.js:386-394`,
  `offscreen.js:24-32`.
- `parseHfRepo` — 4 cópias.
- `startDownload` já divergiu (`popup.js:268-332` vs `dock.js:580-636`).
- `apply()` em duplicata.
- `motorAlive`: dock usa (`dock.js:513-514`); popup ignora (`popup.js:118`).

## Constraint de plataforma (não negociar na hora)

- Sem bundler. `minimum_chrome_version` é **116** (`manifest.json:7`).
- `dock.js` é **content script clássico** (`manifest.json:49-52`), não página.
  Content scripts `"type": "module"` só no Chrome 120+.
- `popup.html:78` é `<script src="popup.js">` clássico.
- `inject.js` é MAIN world no mesmo espírito — **não** misturar no bloco
  module dos content_scripts.
- `background.js` é SW clássico (`manifest.json:24-26`).
- `offscreen.html` já é `type="module"` — exceção.

Por isso a opção A (`import` estático em popup+dock+SW) **quebra o dock**
em Chrome 116–119 e exige `web_accessible_resources` + bump de versão.

## Estratégia — opção B (default)

Arquivo `extension/shared.js`: IIFE que atribui `globalThis.VCShared = { ... }`
(funciona em window e no service worker).

Carregamento:

1. `popup.html`: `<script src="shared.js"></script>` **antes** de `popup.js`.
2. `dock.js`: o pack (ou o manifest) precisa do shared no **mesmo mundo**
   do content script. Caminho sem bump de Chrome:
   - Incluir `"js": ["shared.js", "content.js", "dock.js"]` no content_script
     de `document_start` **isolado** (não no bloco do `inject.js` MAIN world).
   - `shared.js` só define `VCShared`; não assume DOM.
3. `background.js` e `offscreen.js`: **não** converter para module nesta
   parte. Manter cópia das funções quentes com comentário
   `// SYNC: shared.js` + teste 7.7 (ou um `scripts/check-shared-sync.mjs`)
   que falha se o corpo de `normalizeKind` / `parseHfRepo` divergir.

Opção A (module) fica **fora desta parte**. Só reabrir se o maestro aceitar
`minimum_chrome_version: "120"`, `"type": "module"` nos content_scripts
isolados, `web_accessible_resources` para `shared.js`, e SW
`"type": "module"`. `inject.js` permanece clássico MAIN world noutro bloco.

## Implementação

1. Criar `extension/shared.js` (IIFE / `globalThis.VCShared`) com:
   - `normalizeKind`, `parseHfRepo`
   - `stateLabel(state)` (ok/warn) — o que popup e dock realmente compartilham
   - `startDownloadCore(ui)` com callbacks de render
2. `popup.js` e `dock.js` usam `VCShared.*` e apagam as cópias.
3. Não mover `MODEL_REPOS` / `friendlyError` para o shared **a menos** que
   o teste de sync cubra as cópias que restarem em background/offscreen.
4. `pack-extension.mjs` já faz `walk(extension/)` — `shared.js` entra no zip
   sozinho. Ainda assim: o manifest **tem** que listar `shared.js` no
   content_script, senão o dock não carrega.

## Critérios de aceite

- [ ] `normalizeKind` / `parseHfRepo` em popup e dock vêm de `VCShared`.
- [ ] Cópias em `background.js` / `offscreen.js` têm `// SYNC: shared.js` e
      o teste de sync (esta parte ou 7.7) está verde.
- [ ] Popup e dock: provider, download, aplicar, Instalar/Ligar iguais.
- [ ] Zip contém `shared.js`; carregar a pasta `extension/` no Chrome não
      quebra o dock (content script clássico).
- [ ] `minimum_chrome_version` continua 116.

## Verificação

1. `node scripts/pack-extension.mjs` → zip tem `shared.js`.
2. Recarregar: popup e dock, mudar provider, baixar, aplicar — iguais.
3. Nemotron custom: mesma mensagem de orientação nos dois.
4. Chrome 116-compat: nenhum `import` no `dock.js`.
