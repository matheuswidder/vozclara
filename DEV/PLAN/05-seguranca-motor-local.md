# Parte 5 — Segurança do motor local + estados mentirosos

**Resolve**: M3 (abuso do motor), M1 e M2 (estados falsos), M6 (pip em runtime).

**Depende de**: Parte 2 se o mesmo agente mexe em `background.js` (fazer 2
primeiro). **Antes da**: Parte 1 (1.4 lê `VOZCLARA_MODEL_STATUS`).

Ameaça real do M3: **roubo de CPU/GPU** — um site manda *o próprio* áudio a
`127.0.0.1:8173` e recebe a transcrição. O motor **não** lê áudios do
WhatsApp. Não chamar isso de “vazamento de PTT”.

## 5A. Motor local: token obrigatório

### Problema

`vozclara-local/server.py:255-259` — CORS `*` +
`Access-Control-Allow-Private-Network: true`; POST `/inference` sem auth
(`:291-310`).

Com PNA/LNA liberado (Chrome antigo, ou usuário aceitando o prompt no
Chrome 142+), qualquer página HTTPS pode usar o motor.

### Decisão (um esquema só)

Fonte da verdade do token: arquivo
`%LOCALAPPDATA%/VozClara/motor.token` (uma linha, 128 bits hex). No macOS/
Linux: `~/.local/share/VozClara/motor.token`.

A extensão **não** inventa um token paralelo. Ela **adota** o do motor.

Fluxo:

1. Boot do motor: se o arquivo não existe, gera o token e grava (chmod
   restrito no POSIX). Se existe, carrega.
2. `GET /health` **nunca** devolve o token. Só `{ ok, ready, model, engine, paired: true }`.
3. `POST /pair` — **entrega** o token à extensão, não o recebe:
   - Corpo vazio (ou `{}`).
   - Aceito **somente** se `Origin` começa com `chrome-extension://` **ou**
     o header `Origin` está ausente (curl na máquina).
   - Qualquer `Origin` `http:` / `https:` → 403. Isso mata first-writer-wins
     de site malicioso (o browser sempre manda Origin em `fetch` de página).
   - Resposta 200: `{ token: "<hex>" }`.
4. Extensão (`background.js`):
   - Se `chrome.storage.local.motorToken` existe, usa.
   - Senão, ou em 401 com corpo `{ unpaired: false, error: "bad token" }`:
     **não** chama `/pair` de novo às cegas.
   - Chama `POST /pair` só quando não tem token **ou** o motor responder
     `{ unpaired: true }` (arquivo apagado / `--reset-token`).
   - Guarda o token devolvido em `chrome.storage.local.motorToken`.
5. `/inference` e `/v1/audio/transcriptions` exigem
   `Authorization: Bearer <token>` (multipart `token` também aceito, mesmo
   valor). Sem header / errado → 401 `{ error, unpaired: false }`.
6. CORS em **todas** as respostas, inclusive OPTIONS:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Access-Control-Request-Private-Network
Access-Control-Allow-Private-Network: true
```

`Authorization` **tem** que estar em `Allow-Headers`. Sem isso o preflight
do `fetch` da extensão/página quebra. `*` + Bearer **sem** cookies é OK
(`Allow-Credentials` continua ausente).

7. `--reset-token`: apaga o arquivo, gera outro, loga “pareie de novo pelo
   painel VozClara”. Extensão: apagar `motorToken` do storage e só então
   `/pair`.

**Proibido:** retry automático de `/pair` em todo 401 (motor já pareado com
outro token recusaria, e um retry sem checar Origin no servidor reabre o
ataque). **Proibido:** first-writer-wins “aceita o primeiro POST /pair
{token} de qualquer origem”.

### Migração (motor já copiado em `%LOCALAPPDATA%`)

`Instalar-Motor.bat` copia `server.py` para `%LOCALAPPDATA%\VozClara\`
(`Instalar-Motor.bat:11`). Atualizar só o zip da extensão **não** atualiza
esse arquivo.

- Documentar no `LEIA-ME.txt` do motor: após atualizar a extensão, rode de
  novo `Instalar-Motor.bat` (ou copie o `server.py` novo por cima).
- Extensão nova + `server.py` velho (sem auth): o `Authorization` é
  ignorado e o motor continua aberto. Detectar: `/health` sem campo
  `paired` → tratar como motor desatualizado, mostrar “Atualize o motor no
  PC” em vez de mandar Bearer e achar que está seguro.
- `server.py` novo + extensão velha (sem token): 401. Aceitável nesta
  parte — a extensão sobe no mesmo ciclo. Não manter modo “auth opcional”
  em produção.

### Critérios de aceite (5A)

- [ ] `curl -X POST http://127.0.0.1:8173/inference` sem token → 401.
- [ ] `curl -X POST /pair -H "Origin: https://evil.example"` → 403 e não
      grava token.
- [ ] `curl -X POST /pair` sem Origin → 200 com token; o mesmo token em
      `Authorization: Bearer` transcreve.
- [ ] Extensão (Origin `chrome-extension://…`) transcreve após um `/pair`
      bem-sucedido; o usuário não cola token.
- [ ] Página HTML de teste em `https://` (ou origem web) com
      `fetch('http://127.0.0.1:8173/inference', { method:'POST', ... })`
      não transcreve (403 no pair / 401 no inference).
- [ ] `Allow-Headers` inclui `Authorization` (preflight OPTIONS não falha).

## 5B. `wakeMotor` não deve mentir sobre instalação

### Problema

`background.js:1003`: `await chrome.storage.local.set({ motorInstalled: true });`
é a primeira linha — antes de evidência. Quem nunca instalou vê “Ligar motor”.

### Implementação

- Remover o `set` inicial de `motorInstalled` em `wakeMotor()`.
- `motorInstalled` só vira `true` quando `probe.ok` (motor respondeu) —
  os `set` posteriores em `wakeMotor()` / `beginNemotron()` já fazem isso.
- Dock/popup: sem `motorInstalled` → “Instalar no PC”; motor morto depois
  de instalar → “Ligar motor”.

## 5C. `scanModelCache` — “Pronto” só com arquivos completos

### Problema

`background.js:498`: `ready: onnxCount >= 1 && files.length >= 2`.

### Implementação

- Essenciais por **nome** na URL: `config.json`, `preprocessor_config.json`,
  `tokenizer.json` **ou** `tokenizer_config.json`, e ≥1 `.onnx`.
- Tamanho do ONNX: usar `Content-Length` do `Response` em cache
  (`res.headers.get("content-length")`) ou `res.blob().size` **só** se o
  header faltar. Limiar: `> 1_000_000` bytes. **Não** ler todos os blobs
  no caminho quente.
- `ready` = essenciais presentes + ONNX válido. Senão `ready: false` e
  label “Download incompleto — baixe de novo”.

## 5D. Instalador explícito de dependências Python

### Problema

`server.py:42-45, 77-107`: `pip install --user` na primeira execução.
`Instalar-Motor.bat:41` instala uma lista **hardcoded sem `faster-whisper`**,
embora copie `requirements.txt` (`:12`). O default do servidor é
faster-whisper (`server.py:23-28`) — instalação “limpa” pelo `.bat` ainda
cai no pip em runtime.

### Implementação

- `Instalar-Motor.bat` e `Instalar-Motor.command`:
  `pip install --user -r requirements.txt` (o arquivo já lista
  `faster-whisper` e o resto). Não manter a lista hardcoded.
- `server.py`: `ensure_faster_whisper` / `ensure_nemotron_deps` **falham**
  com “Rode Instalar-Motor.bat” em vez de instalar sozinhas.
- Auto-pip só se `VOZCLARA_PACKAGED=1` (setar no `.bat`/Setup.exe).

## Verificação

1. 5A: os curls e a página web da lista de aceite acima.
2. 5B: apagar `motorInstalled` com motor desinstalado → “Instalar no PC”.
3. 5C: tirar `config.json` do Cache API → “Download incompleto”, não “Pronto”.
4. 5D: venv novo + `Instalar-Motor.bat` → `faster-whisper` importável **antes**
   do primeiro `Iniciar-Motor.bat`; `server.py` sem `VOZCLARA_PACKAGED` não
   chama pip.
