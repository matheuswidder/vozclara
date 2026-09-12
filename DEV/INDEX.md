# Índice da documentação técnica — VozClara

Mapa compacto. Abra apenas o necessário para a tarefa atual.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `AUDIT/RELATORIO.md` | Auditoria completa (promessas vs. implementação, achados por severidade) |
| `PLAN/00-ROADMAP.md` | Ordem canônica `2 → 3 → 5 → 1 → 4 → 6 → 7` e donos por arquivo |
| `PLAN/01-estados-claros.md` | Parte 1 — Estados de progresso reais no card do WhatsApp |
| `PLAN/02-cache-storage.md` | Parte 2 — Poda do cache de transcrições (estouro do storage) |
| `PLAN/03-webgpu.md` | Parte 3 — Habilitar WebGPU real no Whisper |
| `PLAN/04-captura-audio.md` | Parte 4 — Não mutar/pausar mídia do usuário durante a captura |
| `PLAN/05-seguranca-motor-local.md` | Parte 5 — Segurança do motor local + estados mentirosos |
| `PLAN/06-refatoracao-compartilhada.md` | Parte 6 — Unificar código duplicado popup/dock |
| `PLAN/07-polimento.md` | Parte 7 — Itens baixos (performance scan, cancelar, detalhes) |
| `SPECS/ACTIVE.md` | Contrato da tarefa atual (status das partes) |
| `HANDOFF.md` | Contexto de retomada para qualquer agente |
| `WORKLOG.md` | Registro curto de trabalho executado |
| `VERIFY.md` | Como validar cada mudança |

## Visão rápida do projeto

- **Site** (`src/`): landing TanStack Start + React 19 que serve a extensão (`public/vozclara.zip`) e documenta instalação. Deploy Vercel.
- **Extensão** (`extension/`): Chrome MV3. Injeta botão "Transcrever" nos áudios de `web.whatsapp.com`. Provedores: Whisper no Chrome (offscreen + transformers.js), motor Python local (`127.0.0.1:8173`), ou nuvem ([OI]/Groq/Gemini/xAI).
- **Motor local** (`vozclara-local/`): Python (faster-whisper ou Nemotron), HTTP em `127.0.0.1:8173`.
- **Empacotamento** (`scripts/pack-extension.mjs`): gera o zip da extensão (inclui `engine/` com instalador do motor quando presente).

## Ordem de execução

Não tratar as partes como independentes. Ver `PLAN/00-ROADMAP.md`.
Próxima: Parte 2 (`PLAN/02-cache-storage.md`).

## Regra de ouro da extensão

Seletores do WhatsApp Web (`data-icon`, `data-testid`) mudam sem aviso. Qualquer alteração em
`content.js`/`dock.js` exige teste manual em `web.whatsapp.com` (ver `VERIFY.md`).
