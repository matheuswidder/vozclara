# Auditoria VozClara — Relatório completo

Data: 2026-09-11 · Escopo: `extension/`, `vozclara-local/`, landing (`src/`)

## Veredito

O produto entrega o essencial do que promete (transcrição local real, privacidade
preservada no modo local), mas a **comunicação de estados é confusa** (o maestro
relatou: "não tem clareza se tá baixando, se tá analisando, se tá bom ou não") e a
integração com o WhatsApp Web é **engenhosa porém frágil por natureza**.

Nota: 7/10 robustez · 5/10 clareza de UX.

## Como a integração funciona (resumo técnico)

Fluxo do clique em "Transcrever":

1. `content.js` injeta um card (Shadow DOM) ao lado de cada áudio detectado.
2. Captura do áudio, em ordem de tentativa:
   a. `src`/`currentSrc` de um `<audio>` dentro ou perto da mensagem.
   b. `src` lembrado por mensagem (`srcByRoot`, via eventos `play`/`loadedmetadata`).
   c. **Sequestra APIs da página** (`inject.js`, mundo MAIN): `URL.createObjectURL`,
      setter `.src`, `setAttribute('src')`, `decodeAudioData` → captura blobs via
      `postMessage`.
   d. Último recurso: clica no play da mensagem, silencia TODOS os media da página,
      acelera a 16x, espera até 14s capturando o blob, depois pausa e restaura tudo.
3. Blob → base64 → `background.js` roteia para o provedor:
   - `local` + Whisper: offscreen document com transformers.js (Whisper ONNX).
   - `local` + nemotron: HTTP `127.0.0.1:8173` (motor Python, protocolo `vozclara://`).
   - nuvem: OpenAI / Groq / Gemini / xAI (chave guardada em `chrome.storage.local`).
4. Cache do resultado por SHA-256 do áudio + provedor + idioma.

## Pontos fortes

- Privacidade honesta no modo local (áudio não sai da máquina).
- Decode OGG/Opus com 3 estratégias em cascata (WebAudio → WebCodecs → WASM),
  incluindo demuxer OGG escrito à mão (`offscreen.js:297-636`).
- Erros traduzidos por sintoma em português claro (`friendlyError`).
- Shadow DOM isolado, `escapeHtml` no resultado, CSP correto.
- Cache de transcrições evita re-pagar API.

## Achados por severidade

### 🔴 ALTO

| ID | Onde | Problema |
|---|---|---|
| A1 | `background.js:1307` | Cache `tx:*` cresce sem poda; `storage.local` tem 10 MB e sem `unlimitedStorage`. Quando encher, o `set` lança **depois** da transcrição OK → usuário vê "Falha ao transcrever" com o sistema funcionando. |
| A2 | `offscreen.js:161-163` | `hasWebGPU()` retorna `false` fixo — todo o caminho WebGPU é código morto; transcrição WASM lenta (minutos) onde poderia ser segundos. |
| A3 | `content.js:810-815`, `515-525` | Progresso de transcrição é só cronômetro; o evento `VOZCLARA_PROGRESS` (que tem % do download) é roteado para `lastVoice`, que pode ser outra mensagem. |

### 🟡 MÉDIO

| ID | Onde | Problema |
|---|---|---|
| M1 | `background.js:1003` | `wakeMotor()` grava `motorInstalled: true` antes de evidência — botão vira "Ligar motor" para quem nunca instalou. |
| M2 | `background.js:498` | `scanModelCache` considera "Pronto" com 1 ONNX + 1 arquivo qualquer — download interrompido mostra estado mentiroso. |
| M3 | `vozclara-local/server.py:255-259` | CORS `*` + `Allow-Private-Network: true` — **qualquer site visitado** pode usar o motor local do usuário (CPU) sem token. |
| M4 | `dock.js:452`, `popup.js:218` | "Recarregue o WhatsApp (F5) para valer" é falso — provider é lido do storage a cada transcrição. Aumenta a confusão relatada. |
| M5 | `offscreen.js:266-275` | Fallback silencioso turbo→small degrada qualidade sem avisar. |
| M6 | `server.py:42-45,77-107` | `pip install --user` em runtime, silencioso, na primeira execução. |
| M7 | `popup.js` / `dock.js` | Duplicação de `normalizeKind`, `parseHfRepo`, save/load, `startDownload` — já divergindo. |

### 🟢 BAIXO

- `content.js:912`: `setInterval(2500)` roda com aba em segundo plano (usar `visibilitychange`).
- `voiceTimes`/`durationLabel` podem pegar `0:42` de resposta citada, não do áudio.
- Chave Gemini vai na query string (padrão da API; vaza em logs de proxy).
- Sem botão de cancelar transcrição.
- Zero testes unitários na extensão (o site tem testes).

## Fragilidades estruturais (não-corrigíveis, mitigáveis)

1. Seletores do WhatsApp Web mudam sem aviso → testes manuais após qualquer mudança.
2. Captura via play simulado depende do comportamento interno do player → manter as
   3 rotas de captura e melhorar mensagens quando todas falham.
