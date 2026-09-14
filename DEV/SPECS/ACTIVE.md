# SPEC ATIVO — Melhorias VozClara pós-auditoria

Data: 2026-09-11
Origem: auditoria `DEV/AUDIT/RELATORIO.md` + pedido do maestro
("avaliar promessas vs. realidade, clareza de estados, integração com WhatsApp Web")

Revisão dos planos: 2026-09-11 (segunda opinião). Os 7 planos foram
corrigidos; a ordem canônica está em `DEV/PLAN/00-ROADMAP.md`.

## Escopo

Executar as 7 partes em `DEV/PLAN/` **na ordem serial**:

`2 → 3 → 5 → 1 → 4 → 6 → 7`

Partes 1–5 **não** são independentes por arquivo. Não paralelizar dois
agentes em `content.js`, `background.js` ou `offscreen.js`.

## Status

| Seq | Parte | Status | Dono |
|---|---|---|---|
| 1 | 2 — Poda do cache tx:* | feito | `background.js` |
| 2 | 3 — WebGPU real | feito | `hasWebGPU` + `localModelDevice` |
| 3 | 5 — Segurança motor local + estados | feito | token/`/pair`/5C `disk.ready` |
| 4 | 1 — Estados claros no card | feito | requestId + fases no card |
| 5 | 4 — Captura sem mutar mídia alheia | feito | `waitForCapture(root)` |
| 6 | 6 — Unificar popup/dock via `VCShared` | feito | IIFE clássico, popup com `motorAlive` |
| 7 | 7 — Polimento | feito | Cancelar no `onMessage`; 7.2 UI; testes explícitos |

Correções da verificação 2026-09-11 aplicadas. Checklist WhatsApp Web ainda é manual (`DEV/VERIFY.md`).

2026-09-13: fluxo do motor passou a **zip no site + Setup uma vez + verificar**.
A extensão não baixa mais o `.exe` via `chrome.downloads`.

2026-09-13: Gemma sugere **só no áudio**, depois de Transcrever. Contexto =
mensagens da conversa + até 5 áudios anteriores ainda sem texto.

## Fora de escopo

- Reescrever a técnica de captura (sequestro de APIs MAIN world permanece — é o que
  faz o produto funcionar de forma confiável hoje).
- Commit/push (maestro valida).
- Mudanças na landing (`src/`) — não foi alvo de crítica na auditoria.
- Opção A (ES modules no dock/content script) — recusada; `minimum_chrome_version`
  permanece 116. Ver Parte 6.

## Definição de pronto (global)

- Todas as partes com critérios de aceite marcados e verificação executada
  (ver `DEV/VERIFY.md`).
- `npm test` e `npm run build` verdes (o site não deve regredir).
- Extensão reempacotada (`node scripts/pack-extension.mjs`) e testada manualmente
  no WhatsApp Web.
- Checklist manual de `DEV/VERIFY.md` é o gate da extensão; `npm test`/`build`
  não a substituem.
