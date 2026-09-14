# VERIFY — Como validar as mudanças da extensão

## Ambiente

- Recarregar a extensão após cada mudança: `chrome://extensions` → ícone de reload
  da VozClara (ou carregar a pasta `extension/` sem compactação).
- Reempacotar o zip do site: `node scripts/pack-extension.mjs` (gera `public/vozclara.zip`).
- Regressão do site: `npm run build` e `npm test`.
- Gate da extensão = checklist manual abaixo. Build/test do site não a cobrem.

## Checklist manual no WhatsApp Web (obrigatório para qualquer mudança em
`content.js` / `inject.js` / `dock.js`)

1. **Detecção**: abrir conversa com áudios → botão "Transcrever" aparece em todos.
2. **Falsos positivos**: mensagens com resposta citada de áudio não ganham card
   indevido.
3. **Transcrição local**: com Whisper baixado, transcrever → texto correto, sem som
   audível.
4. **Captura forçada**: transcrever áudio que nunca foi tocado nesta sessão →
   funciona (rota do play simulado).
5. **Tema claro/escuro**: alternar tema do WhatsApp → card acompanha.
6. **Dock**: botão na rail do WhatsApp abre painel; teste de arquivo local funciona.
7. **Conflito de mídia** (Parte 4): vídeo reproduzindo em outra conversa não é
   afetado durante a transcrição.
8. **Sugestão Gemma**: sem barra “Sugerir resposta” no campo de texto; sem mini
   em mensagem escrita. Transcrever um áudio (Gemma ligada) → “Sugerir resposta”
   no card. Clicar → transcreve áudios anteriores sem texto (até 5) + lê
   mensagens enviadas/recebidas → chips no card e coláveis acima do compose.

## Validações por parte

### Parte 2 (cache) — fazer primeiro
- Console do **service worker**: 250 chaves `tx:fake-*` → `await pruneCache()` →
  ≤ 200 chaves `tx:*`. (`pruneCache` é função de módulo do SW clássico.)
- Mesmo áudio duas vezes → segunda instantânea (hit de string legado e de `{t,text}`).
- Cota real: `set({ _fill: "a".repeat(9e6) })` até o próximo `tx:*` rejeitar;
  transcrever → UI **não** mostra “Falha ao transcrever”. Apagar `_fill`.
  250 strings curtas **não** enchem 10 MB.

### Parte 3 (WebGPU)
- `chrome://gpu` com WebGPU ativo → estado final / storage `localModelDevice`
  = `webgpu` (badge dock/popup).
- Sem WebGPU (ou GPU desligada em `chrome://settings/system`) → wasm, sem erro.

### Parte 5 (motor local)
- `curl -X POST http://127.0.0.1:8173/inference` sem token → 401.
- `curl -X POST http://127.0.0.1:8173/pair -H "Origin: https://evil.example"` → 403.
- `curl -X POST http://127.0.0.1:8173/pair` sem Origin → 200 + token; Bearer transcreve.
- Extensão transcreve após `/pair` (usuário não cola token).
- Motor desinstalado + `motorInstalled` apagado → “Verificar o motor” + hint do zip.
- A extensão **não** dispara download do `.exe`. Rode `engine/VozClara-Motor-Setup.exe` do zip **uma vez**.
- Motor já em `%LOCALAPPDATA%\VozClara` + fechado → Setup / atalho / Ligar o motor
  **só abre** (sem pip, sem “Baixando bibliotecas”).
- Depois do Setup: Verificar → bandeja verde.
- `/health` sem campo `paired` → tratar como motor desatualizado.
- Gemma falhou: pill “Falhou”, status com o motivo, botão “Tentar de novo”.
  Motor que cai no meio do download (RAM) não volta mais para “Não baixou”.

### Parte 1 (estados)
- Fases ① / ③ (e ② no primeiro download). O cronômetro **não** apaga a % de
  download no segundo seguinte.
- Progresso no card clicado, não no último `contextmenu`.
- Voltar à conversa: fase reaparece (`htmlByKey`).

### Parte 4 (captura)
- Checklist item 7.
- Contextmenu noutro áudio durante a captura forçada → blob continua o da
  mensagem original (`waitForCapture(root)`).

### Parte 6 (refatoração)
- Popup e dock idênticos (provider, download, aplicar, Instalar/Ligar).
- `dock.js` sem `import`; zip contém `shared.js`; Chrome 116 ainda carrega.

### Parte 7 (polimento)
- Trocar provider e transcrever sem F5; nenhum `#reload-hint` visível
  (popup, dock, options).
- Aba oculta: interval 2,5 s parado (Observer pode seguir).
- `npm test` cobre `extension/tests/*.test.mjs` (`shared.js`).

## Comandos

```bash
npm test                      # site; após Parte 7 também extension/tests
npm run build                 # build do site
node scripts/pack-extension.mjs  # reempacotar extensão
npm run typecheck             # site
```
