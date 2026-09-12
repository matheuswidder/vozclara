# HANDOFF — Contexto de retomada

## Estado atual (2026-09-11)

As 7 partes estão no código **e** as falhas da verificação foram corrigidas:

- Cancelar chega no `onMessage` (`VOZCLARA_STT_CANCEL`); `pending` guarda
  `requestId` do card; resultado cancelado não vai para o cache.
- `rootByKey.get(key)` (não chamar o Map como função).
- `verifyModel.ready` usa `disk.ready`, não o `stored` velho.
- `transcribe()` devolve `model` e `device` para o card.
- Progresso de download leva `requestId`/`key`/`phase: download`.
- 7.2: popup e dock leem `takeQualityFallback()`.
- Popup usa `motorAlive` como o dock.
- `npm test` lista os arquivos de `extension/tests/` (9 testes verdes).

## Próximo passo

Checklist manual no WhatsApp Web (`DEV/VERIFY.md`). Recarregar a extensão
pela pasta `extension/` após o pull.

## Regras que continuam

- Sem bundler; dock é content script clássico; Chrome 116.
- Motor em `%LOCALAPPDATA%\VozClara\` não atualiza só com o zip.
- Não commitar sem pedido do maestro.
