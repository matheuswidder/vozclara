# Parte 1 — Estados de progresso reais no card do WhatsApp

**Resolve**: A3 + queixa do maestro ("não tem clareza se tá baixando, se tá analisando, se tá bom ou não").

**Depende de**: Parte 5C (`VOZCLARA_MODEL_STATUS` honesto). **Antes da**: Parte 4 (mesmo `content.js`).

Não mexe em `dock.js`.

## Problema atual

Dois bugs distintos, não um só:

1. **Timer no lugar de fases** (`content.js:810-815`): o card mostra
   `Transcrevendo… 0:42` a cada 1s. Isso **sobrescreve** qualquer
   `VOZCLARA_PROGRESS` de download em ≤1 s — é a causa principal da queixa.
2. **Roteamento pelo `lastVoice`** (`content.js:515-525`): `VOZCLARA_PROGRESS`
   (hoje só % de **download** do modelo, via `background.js:96-105`) vai para
   `lastVoice`. `lastVoice` **não é hover**: é o último root de `contextmenu`
   (`content.js:500-510`) ou o `root` de `transcribeRoot` / `extractBlob`.
   Clique com o direito noutro áudio no meio do processo pinta o card errado.
3. Modelo ausente: o erro manda “procurar o ícone da extensão” em vez de
   oferecer o download no próprio card.

Hoje **não existe** % de inferência. `offscreen.js:653-658` chama o pipeline
sem callback de progresso.

## Estado-alvo (máquina de estados no card)

Etapas numeradas, **uma linha por vez**:

```
① Lendo o áudio (0:42)…            ← extração do blob
② Preparando Whisper — 43%         ← download do modelo (só primeira vez), com MB
③ Transcrevendo — áudio de 1:23    ← inferência: fase + duração/tempo (não % fantasma)
✓ Pronto · large-v3-turbo · 8s     ← resultado + botão Copiar
✗ Erro + ação de recuperação no próprio card
```

Regras de design:

- Nunca duas informações competindo.
- Download do modelo: % **real** (já existe em `onHfProgress`) + tamanho
  aproximado + aviso “só a primeira vez”.
- Inferência: **não** inventar `chunksConcluidos/chunksTotais`. A
  `transformers.js` vendorizada não expõe callback por janela de áudio
  (loop interno em `vendor/transformers.js`; `progress_callback` é de
  download; `callback_function` é de token de texto).
- Erro sempre com botão contextual (“Tentar de novo”, “Baixar agora”,
  “Ligar motor”) — já existe, manter.

## Implementação

### 1.1 Roteamento por `requestId` + `keyFor(root)` — não um `activeKey` global

**Arquivo**: `extension/content.js` (+ `background.js`)

- `keyFor(root)` já existe (`content.js:229-238`). Usar essa chave.
- **Não** usar `let activeKey = null`. Duas transcrições em paralelo (botão
  só desabilita o card clicado) colidem.
- Em `transcribeRoot(root)`:
  1. Gerar `requestId` (`crypto.randomUUID()`).
  2. Guardar `jobs.set(requestId, keyFor(root))` (Map no IIFE).
  3. Enviar `requestId` (e a `key`) em `VOZCLARA_STT` — hoje
     `content.js:831-837` não manda id.
  4. No `finally`, `jobs.delete(requestId)`.
- Listener de `VOZCLARA_PROGRESS`: resolver o card por
  `msg.key || jobs.get(msg.requestId)`. **Nunca** por `lastVoice`.
- `background.js:96-105` deve reencaminhar `phase`, `detail`, `percent`,
  `label`, `requestId` e `key`. Enquanto o STT corre, `activeTabId` já é
  setado em `transcribeInBrowser`; não zerar no `finally` até o último
  emit de “Pronto” / erro, ou incluir `tabId` no job.

Persistência quando o WhatsApp recicla o DOM:

- `setPanel` já grava `htmlByKey` (`content.js:447`). Continuar gravando o
  HTML da fase (①/②/③) aí.
- Se `!document.contains(root)` no listener, **não descartar**: atualizar
  `htmlByKey.get(key)` com o HTML da fase. `ensureUi` já restaura de
  `htmlByKey` ao recriar o card — o progresso reaparece ao voltar à conversa.

Timer (`content.js:810-815`):

- O interval **não** pode pintar por cima da fase ②/③.
- `clearInterval(timer)` ao receber o primeiro `VOZCLARA_PROGRESS` daquele
  `requestId`, e ao sair de ① para ③ pelo próprio `transcribeRoot`.
- Se quiser relógio na fase ③, o tick só atualiza um `<span data-clock>`
  dentro do HTML da fase, nunca chama `busy()` genérico.

### 1.2 Inferência: fases + duração (caminho default)

**Arquivo**: `extension/offscreen.js`

Caminho **obrigatório** (não fallback):

1. Antes de `toMono16k`: `emit({ phase: "decode", label: "Lendo o áudio…" })`.
2. Depois do decode, com `audio.length / 16000`:
   `emit({ phase: "transcribe", detail: "áudio de 1:23", label: "Transcrevendo…" })`.
3. Depois do `pipe()`: emit de Pronto como hoje.

Não implementar wrapper do loop interno da lib nesta parte. Token callback
não vira % de áudio — não usar.

### 1.3 Contrato de mensagens

```js
{
  type: "VOZCLARA_PROGRESS",
  requestId: "uuid",          // obrigatório no caminho STT
  key: "data-id ou vc-N",     // se conhecido
  phase: "download" | "decode" | "transcribe",
  percent: 0-100,             // só em download; omitir na inferência
  label: "string curta",
  detail: "214/560 MB" | "áudio de 1:23"
}
```

`content.js` por fase: `download` → barra; `decode` → ①; `transcribe` → ③
com duração/tempo; nunca barra genérica sem fase.

### 1.4 Primeiro uso sem fricção

**Arquivo**: `extension/content.js` (+ `background.js`)

- Antes de `extractBlob()`, `VOZCLARA_MODEL_STATUS` (já existe,
  `background.js:22-26`, hoje devolve `storedStatus()`).
- Se `!ready && !downloading`: card com “Whisper ainda não foi baixado
  (~560 MB, só uma vez)” + `[ Baixar agora ]` → `VOZCLARA_MODEL_DOWNLOAD`.
- Se `downloading`: fase ② com % , sem erro.
- **Parte 5C tem que ter rodado**: senão `ready` mentiroso bloqueia o
  download. Não implementar 1.4 contra um `scanModelCache` velho.

## Critérios de aceite

- [ ] Modelo pronto: ① depois ③ com duração ou tempo — nunca só o cronômetro
      genérico, nunca barra sem fase.
- [ ] Modelo ausente: card oferece download; % real do download no **mesmo**
      card; timer não apaga a %.
- [ ] Progresso não aparece noutro card (contextmenu no meio do processo).
- [ ] Trocar de conversa e voltar: a fase reaparece (htmlByKey), não some.
- [ ] Label final inclui modelo + tempo gasto.

## Verificação

1. Recarregar a extensão (pack se for entregar zip).
2. Transcrever áudio com modelo já baixado → ① e ③ no card clicado.
3. Limpar storage → Transcrever → oferta de download e ② com % que **não**
   vira “Transcrevendo… 0:03” no segundo seguinte.
4. Duas conversas: transcrever na A, contextmenu num áudio da B, voltar à A
   → progresso continua/reaparece em A.

## Riscos

- Duas transcrições simultâneas: o Map `requestId → key` é o que evita
  misturar; um `activeKey` único reintroduz A3.
- Seletores do WhatsApp: teste manual obrigatório (`DEV/VERIFY.md`).
