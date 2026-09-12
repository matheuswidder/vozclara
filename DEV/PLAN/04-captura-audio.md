# Parte 4 — Captura de áudio sem mutilar a mídia do usuário

**Resolve**: efeito colateral grave da captura (mute global + play 16x + pausa geral).

**Depende de**: Parte 1 (mesmo `content.js`; o aviso 4.3 usa a fase ①).
Não começar em paralelo com a Parte 1.

## Problema atual

`content.js:605-638` (`muteForCapture` / `restoreMedia`):

- Ao falhar a captura passiva, o código:
  1. silencia **todos** `<audio>`/`<video>` da página,
  2. seta `playbackRate = 16` em todos,
  3. clica no play do áudio alvo,
  4. no fim, **pausa todos** e restaura volume/taxa.
- Se o usuário está **ouvindo um áudio ou assistindo um vídeo** em outra conversa
  (Picture-in-Picture, vídeo direto), ele é silenciado/acelerado e **pausado** no
  meio do processo. Violência desnecessária ao usuário.

## Estratégia

Escopo reduzido: manipular **apenas o `<audio>` da mensagem alvo**, nunca toda a
página. O snapshot global e o loop em `document.querySelectorAll("audio, video")`
viram operações sobre um único elemento.

## Implementação

**Arquivo**: `extension/content.js`

### 4.1 Escopo único

Refatorar:

```js
function muteForCapture(media) {
  if (!media) return;
  snapshotMedia(media);
  try {
    media.muted = true;
    media.defaultMuted = true;
    media.volume = 0;
    media.playbackRate = 16;
  } catch { /* ignore */ }
}

function restoreMedia(media) {
  if (!media) {
    // restore de emergência: só os que snapshots pendentes tiverem
    document.querySelectorAll("audio, video").forEach((m) => mediaSnap.has(m) && restoreMedia(m));
    return;
  }
  const s = mediaSnap.get(media);
  try { media.pause(); } catch { /* ignore */ }
  try {
    media.muted = s ? s.muted : false;
    media.defaultMuted = s ? s.defaultMuted : false;
    media.volume = s && s.volume > 0 ? s.volume : 1;
    media.playbackRate = s?.rate || 1;
  } catch { /* ignore */ }
  mediaSnap.delete(media);
  window.postMessage({ source: "vozclara", type: "restore" }, "*");
}
```

- Em `extractBlob()` (`content.js:744-782`): chamar `muteForCapture(alvo)` /
  `restoreMedia(alvo)` passando o elemento encontrado por `findAudioEl(root)` —
  **não** a iteração global.
- `snapshotMedia(media)` idem: snapshot só do elemento.

### 4.1b `waitForCapture` amarrado ao `root` (obrigatório)

Hoje `waitForCapture` (`content.js:683-720`) usa `lastVoice` em
`findAudioEl(lastVoice)` e `keyFor(lastVoice)`. `lastVoice` muda no
`contextmenu` (`:500-510`). Nos 14 s da rota forçada isso captura o áudio
**errado**.

- Assinatura: `waitForCapture(root, since, ms)`.
- Trocar as duas leituras de `lastVoice` por `root`.
- `extractBlob` já faz `lastVoice = root` — não basta; passar o parâmetro.
- Confirmar na mão se o WhatsApp reutiliza **um** `<audio>` global para
  todos os PTT. Se `findAudioEl(root)` e o player da outra conversa forem
  o mesmo node, o recorte 4.1 não protege o vídeo/áudio “do outro chat”
  daquele elemento — documentar no WORKLOG se for o caso e mutar só enquanto
  `data-vozclara-silent` estiver ligado (o `hush(this)` do `inject.js` já
  cobre o play do alvo).

### 4.2 Aceleração de taxa (opcional, com cuidado)

- `playbackRate = 16` é o que permite capturar rápido. Restrito ao elemento alvo,
  isso é aceitável — o usuário **clicou** em Transcrever naquela mensagem.
- Se o áudio alvo for o que o usuário está ouvindo ativamente (mesmo elemento),
  mutar é o comportamento correto (ele pediu transcrição).

### 4.3 Aviso visual durante a captura forçada

- Enquanto `extractBlob` roda a rota forçada (play simulado), o card já mostra
  "① Lendo o áudio…". Adicionar micro-texto: "o áudio toca silenciosamente para
  leitura" — 1 linha no card, só nessa fase. Torna o comportamento transparente.

## Critérios de aceite

- [ ] Vídeo/áudio em reprodução em outra parte da página não é silenciado,
      acelerado nem pausado durante a transcrição.
- [ ] O áudio alvo é mutado/acelerado apenas durante a captura e restaurado depois.
- [ ] Captura continua funcionando (mesma taxa de sucesso da rota forçada).
- [ ] `waitForCapture(root, …)` não lê `lastVoice`; contextmenu noutro áudio
      durante os 14 s não desvia o blob.

## Verificação

1. WhatsApp Web: iniciar reprodução de um vídeo numa conversa, abrir outra conversa
   e transcrever um áudio → o vídeo não deve sofrer interferência.
2. Transcrever áudio normal → sucesso, sem som audível, taxa de captura igual.
3. Recarregar extensão e testar as 3 rotas: src direto, src lembrado, captura forçada.

## Riscos

- A rota forçada hoje captura via `recentMedia` (qualquer blob que a página emitir).
  Restringir o mute não afeta a coleta de blobs — risco baixo.
- `inject.js` (mundo MAIN) também muta no `play()` quando `isSilent()` — já é
  element-scoped (`hush(this)`), não precisa mudar.
