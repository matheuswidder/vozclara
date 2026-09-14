# HANDOFF — Contexto de retomada

## Estado atual (2026-09-13)

Fluxo do motor: **um zip no site** (`/vozclara.zip`) com
`engine/VozClara-Motor-Setup.exe`. Instala uma vez. A extensão **só verifica**
se o motor responde — não baixa o `.exe` (o Chrome recusava o segundo download).

Popup/dock: “Verificar o motor”, hint do zip, sugestão Qwen recolhida até ligar.
Setup já instalado: **só liga** o motor em AppData (sem pip). Falha do Qwen
mostra o motivo (não só “Não baixou”). Sugestão **só do áudio transcrito**
(sem contexto da conversa), chips só no card. Clique cola no campo, não envia.

Nemotron ASR transcreve. Qwen2.5-1.5B-Instruct Q4 sugere 3 respostas. Sem Gemma.

As 7 partes da auditoria de 11/09 continuam no código (cancelar, cache,
WebGPU, captura, token, VCShared, polimento).

## Próximo passo

Checklist manual no WhatsApp Web (`DEV/VERIFY.md`). Recarregar a extensão
pela pasta extraída do zip (o Setup entra em `engine/` no pack).

## Regras que continuam

- Sem bundler; dock é content script clássico; Chrome 116.
- Motor em `%LOCALAPPDATA%\VozClara\` não atualiza só com o zip.
