# WORKLOG

## 2026-09-14 — Qwen 1.5B Q4 no lugar do Gemma

- Transcrição continua no Nemotron ASR.
- Sugestão de resposta: `Qwen2.5-1.5B-Instruct` GGUF Q4_K_M (~1,1 GB) via
  llama-cpp-python em CPU. Gemma 4 E2B saiu (estourava 8 GB em float32).
- Painel: um botão Baixar, sem rádios E2B/it/assistant. Extensão 1.13.2.
- Motor antigo: rode de novo o Setup do zip (ele sobrescreve `server.py`).

## 2026-09-14 — Gemma: mostrar o motivo da falha

- O painel dizia só “Não baixou” porque o erro sumia depois do clique e
  porque o motor reiniciava no meio do download (RAM) sem avisar.
- Agora: “Tentar de novo” + texto (Hugging Face, disco, internet, RAM).

## 2026-09-14 — Setup já instalado só liga o motor

- Sem `pip` de novo: se `%LOCALAPPDATA%\VozClara\server.py` e as libs existem,
  o Setup abre a bandeja (`/run`). `/install` força a UI de atualizar.
- Atalho e `vozclara://` apontam para a cópia em AppData com `/run`.
- Extensão: motor já instalado e desligado → Ligar, não “rode o Setup do zip”.

## 2026-09-13 — Sugestão só no áudio, com contexto

- A barra “Sugerir resposta / da última mensagem recebida” saiu do campo de texto.
- Mini “Sugerir” em mensagem escrita também saiu.
- Depois de Transcrever, o card ganha “Sugerir resposta”. Ao clicar, transcreve
  até 5 áudios anteriores sem texto e manda a conversa (enviadas + recebidas)
  junto com o áudio atual para o Gemma.

## 2026-09-13 — Motor no zip + UI (auditoria de fluxo)

- Chrome recusava o Setup porque a extensão baixava o `.exe` (às vezes duas vezes).
  Agora: um zip no site, Setup em `engine/`, **verificar** se o motor responde.
  A extensão **não** dispara `chrome.downloads.download` do `.exe`.
- Popup/dock: hint, botão “Verificar o motor”, Gemma recolhida até ligar, flash/meter.
- Landing: um zip, quatro passos, copy honesta, CTA no header.
- Setup: spinner + barra + botão com feedback. Rebuild do `.exe`.
- `npm test` + pack. Checklist WhatsApp Web continua manual.

## 2026-09-11 — Correção das falhas da verificação

- Cancelar: handler em `onMessage`; `pending.requestId`; card `rootByKey.get`.
- 5C: `ready` = `disk.ready`. STT devolve `model`/`device`.
- Download % no card via `progressTarget` + `phase: download`.
- 7.2 no popup/dock; popup com `motorAlive`.
- Testes: `extension/tests/*.test.mjs` explícitos no `npm test` (9 pass).
- `npm test` 9 + 55 verdes; `node --check` nos JS da extensão OK.
- Checklist WhatsApp Web continua manual.

## 2026-09-11 — Verificação pós-implementação (7 partes)

- Código das 7 partes está no disco; **não** está conforme o plano por
  completo. Veredito: implementado com falhas (HANDOFF).
- Conferido no código: cache `{t,text}`, WebGPU, mute+`waitForCapture(root)`,
  token/`/pair`/CORS, `VCShared` clássico, F5 fora, Gemini header, scan
  visível, duração sem citação.
- Falhas: Cancelar não chega no SW; `rootByKey(key)` TypeError; 5C
  `ready` usa `stored` velho; card final sem modelo; download % sem
  requestId; 7.2 sem UI; popup sem `motorAlive`; `npm test` no Windows não
  executa `extension/tests/` (glob); sync offscreen falha por indent.
- `node --check` nos JS da extensão OK; `py_compile server.py` OK;
  `npm test` site 55/55 (os testes da extensão não entraram nesse comando).
- Checklist WhatsApp Web: não executado.
- Próximo: consertar a lista do HANDOFF, não marcar pronto.

## 2026-09-11 — Revisão dos planos (segunda opinião)

- Sem código. Ajustes só em `DEV/PLAN/*`, `SPECS/ACTIVE.md`, `HANDOFF.md`,
  `VERIFY.md`, `INDEX.md`.
- Cinco correções: (1) 5A pareamento por Origin, CORS `Authorization`,
  migração `%LOCALAPPDATA%`, ameaça = CPU não PTT; (2) ordem serial
  `2 → 3 → 5 → 1 → 4 → 6 → 7` e donos por arquivo; (3) Parte 1 sem
  `activeKey`, timer não pisa progresso, % de chunk não existe na lib;
  (4) Parte 6 = `VCShared` clássico, dock é content script; (5) cache
  `{t,text}` + legado, `waitForCapture(root)`, interval do scan inicia
  se a aba já está visível.
- Próximo: implementar Parte 2.

## 2026-09-11 — Auditoria e plano de melhorias

- Auditoria completa da extensão, motor local e site (promessas vs. implementação).
  Relatório: `DEV/AUDIT/RELATORIO.md` (3 achados ALTO, 7 MÉDIO, 6 BAIXO).
- Plano de implementação criado em 7 partes independentes: `DEV/PLAN/00-ROADMAP.md`
  + `01` a `07`.
- Criados `DEV/INDEX.md`, `DEV/VERIFY.md`, `DEV/HANDOFF.md`, `DEV/SPECS/ACTIVE.md`.
- Nenhum código alterado nesta sessão — apenas documentação.
- Próximo: executar partes conforme `DEV/PLAN/00-ROADMAP.md` (1 e 2 recomendadas
  primeiro).

## 2026-09-11 — Parte 2 (cache) + Parte 5 (motor local) implementadas (Agente A)

- Parte 2: cache `tx:*` vira `{t,text}` com leitores `txText`/`txTime`
  (legado string mantido), `pruneCache()` LRU (TX_KEEP=200) chamada no
  catch de cota e no `onStartup`; falha de cache nunca vira erro.
- Parte 5A: token no motor (`%LOCALAPPDATA%/VozClara/motor.token`),
  `/pair` só para Origin `chrome-extension://` ou ausente, 401 com
  `{unpaired:false}` em `/inference` e `/v1/audio/transcriptions`,
  CORS com `Authorization` em Allow-Headers, `/health` expõe `paired`.
  Extensão adota token (`motorToken`), re-pair só em `unpaired:true`,
  motor desatualizado (`paired:false`) → "Rode de novo o Instalar-Motor".
- Parte 5B: removido `motorInstalled:true` pré-evidência em `wakeMotor()`.
- Parte 5C: `scanModelCache` exige config.json + preprocessor_config.json
  + tokenizer(.config).json + ONNX >1MB (Content-Length, blob como fallback);
  "Download incompleto — baixe de novo" quando quebra o estado pronto.
- Parte 5D: instaladores usam `pip install -r requirements.txt`;
  `server.py` só faz auto-pip com `VOZCLARA_PACKAGED=1`, senão falha com
  "Rode Instalar-Motor".
- Validação: node --check OK; py_compile OK; testes HTTP locais do token
  (pair/401/403/CORS) todos PASS; teste unitário do pruneCache com mock
  de storage PASS; vite build OK; npm test 55/55; typecheck OK.
  `npm run build` falhou só no wrapper `with-app-env.mjs` (spawn vite
  ENOENT no Windows) — pré-existente, contornado com vite direto.
- Pendência manual no Chrome: checklist VERIFY (Partes 2 e 5) + reempacote
  do zip pela integração final.
