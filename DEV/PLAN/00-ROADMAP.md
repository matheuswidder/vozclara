# ROADMAP — Plano de melhoria por partes

Origem: `DEV/AUDIT/RELATORIO.md` · Status de execução: `DEV/SPECS/ACTIVE.md`

Revisão 2026-09-11: as partes **não** são independentes por arquivo. Agentes
paralelos só nos pares listados em “Paralelo permitido”. Um único agente segue
a ordem serial abaixo.

## Ordem serial (um agente — canônica)

| Seq | Parte | Arquivo do plano | Resolve | Por quê nesta posição |
|---|---|---|---|---|
| 1 | **2** | `02-cache-storage.md` | A1 | Só o final de `transcribe()` em `background.js`. Isolado, evita “Falha ao transcrever” por cota. |
| 2 | **3** | `03-webgpu.md` | A2 | Só `hasWebGPU` (+ persistir `device`) em `offscreen.js`. Antes da Parte 1 para não fundir emits. |
| 3 | **5** | `05-seguranca-motor-local.md` | M3, M1, M2, M6 | 5B/5C tornam `VOZCLARA_MODEL_STATUS` honesto **antes** da oferta de download da Parte 1. 5A/5D são `server.py` + `.bat` + token no `background.js` — mesmo PR que 5B/5C. |
| 4 | **1** | `01-estados-claros.md` | A3 + queixa do maestro | Dono de `content.js` + `phase` no offscreen/background. Depende de 5C (status do modelo). |
| 5 | **4** | `04-captura-audio.md` | mute global | Mesmo `content.js` que a Parte 1; o aviso 4.3 usa a fase ①. Não começar antes da 1. |
| 6 | **6** | `06-refatoracao-compartilhada.md` | M7 | Depois de 1 e 5: senão o `shared.js` congela labels velhos (Instalar/Ligar, progresso). |
| 7 | **7** | `07-polimento.md` | baixos + M4, M5 | Depois de 1 (Cancelar na fase ③) **e** 6 (testes importam `shared.js`; F5 está em popup+dock). |

**Não** executar 1–5 “em qualquer ordem”. **Não** paralelizar dois agentes no mesmo arquivo.

## Paralelo permitido (dois agentes, caminhos disjuntos)

Só enquanto a Parte 1 **ainda não** começou:

| Agente | Pode fazer | Arquivos |
|---|---|---|
| A | Parte 2, depois Parte 5 (inteira) | `background.js`, `server.py`, `Instalar-Motor.bat` / `.command` |
| B | Parte 3 | `offscreen.js` apenas |

Depois disso o trabalho em `content.js` é serial: Parte 1 → Parte 4.
Parte 6 e 7 nunca em paralelo com ninguém que mexa em popup/dock/content.

## Sobreposição de arquivos (donos)

| Arquivo | Partes | Ordem no arquivo |
|---|---|---|
| `extension/background.js` | 2, 5, 1, depois 7.4/7.6 | 2 → 5 → 1 → 7 |
| `extension/offscreen.js` | 3, 1, depois 7.2 | 3 → 1 → 7 |
| `extension/content.js` | 1, 4, depois 7.3/7.4/7.5 | 1 → 4 → 7 |
| `extension/dock.js` | 5 (texto Instalar/Ligar), 6, 7 | 5 → 6 → 7 |
| `extension/popup.js` | 5, 6, 7 | 5 → 6 → 7 |
| `vozclara-local/server.py` | **só 5** | — |
| `vozclara-local/Instalar-Motor.bat` (e `.command`) | **só 5** | — |
| `extension/shared.js` (novo) | 6, depois testes na 7 | 6 → 7 |

`dock.js` **não** entra na Parte 1. `server.py` **não** entra na Parte 7.

## Alternativa: fundir PRs no mesmo arquivo

Quem for o único agente pode, para menos retrabalho:

- Um PR `content.js` = Parte 1 + Parte 4.
- Um PR `background.js` = Parte 2 + Parte 5 (5B/5C/token) ; `server.py` no mesmo PR da 5.

A seqüência lógica permanece 2/5 antes de 1, e 1 antes (ou junto) de 4.

## Definição de pronto (todas as partes)

1. Código alterado + sem regressão aparente.
2. `node scripts/pack-extension.mjs` roda e gera zip válido (se empacotar).
3. Teste manual no WhatsApp Web conforme `DEV/VERIFY.md`.
4. Entrada em `DEV/WORKLOG.md` e atualização de `DEV/SPECS/ACTIVE.md`.
