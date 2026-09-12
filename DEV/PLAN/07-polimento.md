# Parte 7 — Polimento (itens baixos)

**Resolve**: itens 🟢 da auditoria + M4, M5.

**Depende de**: Parte 1 (fase ③ / Cancelar) **e** Parte 6 (`shared.js` para
7.7; popup+dock já unificados para 7.1/7.2).

## 7.1 Remover a mentira do "Recarregue o WhatsApp (F5)" (M4)

**Arquivos**: `dock.js:452`, `popup.js:218`, **e** os hints escondidos
`popup.html:76`, `dock.js:333`, `options.html:77`. O JS faz
`hint.hidden = false` (`popup.js:215-216`, `dock.js:448-449`).

- Provider é lido do `chrome.storage` a cada `transcribe()` — F5 não é
  necessário.
- Trocar o texto por: “Aplicado — já vale na próxima transcrição.”
- Não reexibir `#reload-hint`. Remover ou deixar `hidden` para sempre
  (preferível apagar o nó e as linhas que o mostram).
- Validar: local → nuvem e nuvem → local, transcrever **sem** F5.

## 7.2 Avisar fallback de qualidade (M5)

**Arquivo**: `offscreen.js:266-275` (+ dock/popup via Parte 6 / `VCShared`)

O fallback **já avisa** no download (“O modelo grande não coube. Baixando a
versão leve…”). Falta persistir no estado final.

- Emit final com `warning: true` e label clara de qualidade menor.
- Gravar `lastQualityFallback` no storage; pintar amarelo **uma vez** em
  dock e popup (um só código, via shared).

## 7.3 Scan em background: respeitar visibilidade

**Arquivo**: `extension/content.js:904-912`

O snippet antigo **não ligava** o interval se a aba já nascia visível —
o scan de 2,5 s sumia para sempre. O `MutationObserver` continua no
background: o aceite **não** é “zero CPU”.

```js
let idleScan = null;
function startIdleScan() {
  if (idleScan) return;
  idleScan = setInterval(() => scan(document), 2500);
}
function stopIdleScan() {
  if (!idleScan) return;
  clearInterval(idleScan);
  idleScan = null;
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopIdleScan();
  else {
    scan(document);
    startIdleScan();
  }
});
function start() {
  scan(document);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("scroll", positionAll, true);
  window.addEventListener("resize", positionAll);
  if (!document.hidden) startIdleScan();
}
```

Aceite: com a aba oculta, o **interval** não dispara. O Observer pode
continuar — não prometer zero CPU.

## 7.4 Botão de cancelar transcrição

**Arquivo**: `extension/content.js` + `background.js` (offscreen path)

- Só na fase ③ da Parte 1. `VOZCLARA_STT_CANCEL { requestId }`.
- `pending` existe **só** no caminho offscreen (`background.js:88, 314`).
  Nuvem e `server.py` não têm AbortController nesta parte — o Cancelar
  no card volta ao idle e **descarta** o resultado se ainda chegar; não
  promete abortar fetch/Python.
- Offscreen: a inferência segue até o fim; o resultado é ignorado se
  cancelado. Texto no card: “Cancelado — a leitura em curso termina em
  segundo plano.”

## 7.5 `durationLabel` mais preciso

**Arquivo**: `extension/content.js:319-324, 173-176`

- Preferir texto do bloco de áudio/waveform; excluir citação
  (`quoted-message`, reply). Sem match → não mostrar duração, não inventar.

## 7.6 Chave Gemini fora da query string (opcional)

**Arquivo**: `background.js:878-921`

- Header `x-goog-api-key` no lugar de `?key=`.

## 7.7 Testes unitários mínimos

**Depende da Parte 6.** Não importar `offscreen.js` no Node: o arquivo chama
`connect()` no load (`offscreen.js:837`) e usa `chrome.*`.

- Testar o que estiver em `shared.js` (`normalizeKind`, `parseHfRepo`, …).
- Funções que restarem só no offscreen (`demuxOggPackets`, `asrBlockReason`):
  ou extrair para `shared.js` nesta parte, ou deixar fora do `node --test`.
- `package.json` → glob `extension/tests/*.test.mjs` no script `test`.

## Critérios de aceite

- [ ] Nenhum “F5” visível (popup, dock, options) e transcrição após troca de
      provider sem reload.
- [ ] Fallback turbo→leve com aviso persistente (não só durante o download).
- [ ] Aba oculta: interval de scan parado (Observer pode seguir).
- [ ] Cancelar no card Whisper-offscreen volta ao idle.
- [ ] Duração em mensagem com citação é a do áudio, ou vazia.
- [ ] `npm test` inclui testes do `shared.js` e passa.

## Verificação

1. Recarregar, trocar provider, transcrever sem F5.
2. Aba em background ~1 min, DevTools Performance: sem ticks de 2,5 s do
   interval (Observer ok).
3. Mensagem com “0:42” citado → duração do PTT, não da citação.
4. `npm test` verde.
