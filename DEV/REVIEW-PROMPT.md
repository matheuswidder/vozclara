# PROMPT — Revisão independente da auditoria e dos planos VozClara

Copie o bloco abaixo para outra LLM/agente com acesso ao repositório.

---

## Papel

Você é um revisor técnico independente (segunda opinião). Não escreva código.
Sua tarefa é **auditar a auditoria**: verificar se o relatório e os planos abaixo
são tecnicamente corretos, completos e acionáveis. Seja cético: procure erros
factuais, afirmações não verificadas, lacunas e planos que não funcionariam na prática.

## Contexto do projeto

Repositório: `C:\Projects\vozclara-whatsapp` (Windows).
Produto "VozClara": transcrição local de áudios do WhatsApp Web.

- `extension/` — extensão Chrome MV3 (arquivos soltos, sem bundler):
  `manifest.json`, `background.js` (service worker, roteamento de provedores,
  cache de transcrições), `content.js` (cards Shadow DOM + captura de áudio),
  `inject.js` (mundo MAIN, sequestra createObjectURL/src/decodeAudioData),
  `offscreen.js` (Whisper via transformers.js ONNX, decode OGG/Opus em cascata),
  `dock.js` (painel na rail do WhatsApp), `popup.js`, `vendor/` (transformers.js,
  ORT, ogg-opus-decoder).
- `vozclara-local/server.py` — motor Python local (faster-whisper ou Nemotron)
  em `127.0.0.1:8173`.
- `src/` — landing page (TanStack Start) que serve `public/vozclara.zip`.
- `scripts/pack-extension.mjs` — empacota a extensão no zip.

## Documentos a revisar (leia nesta ordem)

1. `DEV/AUDIT/RELATORIO.md` — relatório de auditoria com achados A1–A3 (ALTO),
   M1–M7 (MÉDIO) e itens BAIXOS, cada um com referência arquivo:linha.
2. `DEV/PLAN/00-ROADMAP.md` — ordem, dependências e mapa de arquivos por parte.
3. `DEV/PLAN/01-estados-claros.md` … `DEV/PLAN/07-polimento.md` — 7 planos de
   implementação, cada um com problema, implementação, critérios de aceite e
   verificação.
4. `DEV/SPECS/ACTIVE.md`, `DEV/VERIFY.md`, `DEV/HANDOFF.md` — contrato, validação
   e contexto de retomada.

## O que verificar (checklist obrigatório)

### A. Veracidade das afirmações (contra o código real)
1. **Confirme cada referência arquivo:linha** dos achados A1–A3 e M1–M7. Ex.:
   - A1: o cache `tx:*` em `background.js` realmente grava sem poda? O manifest
     realmente NÃO tem `unlimitedStorage`? `chrome.storage.local` = 10 MB (MV3)
     — correto?
   - A2: `offscreen.js` `hasWebGPU()` realmente retorna `false` fixo? O bundle
     webgpu existe em `extension/vendor/`?
   - A3: o `VOZCLARA_PROGRESS` realmente vai para `lastVoice`?
   - M3: `server.py` realmente tem CORS `*` + PNA true e POST sem autenticação?
2. **Verifique as afirmações técnicas de plataforma**: cota do
   `chrome.storage.local` em MV3; comportamento de `chrome.offscreen`; suporte a
   WebGPU em offscreen documents; se transformers.js (versão vendorizada em
   `extension/vendor/`) expõe callback de progresso por chunk/token — o plano 01
   depende disso e propõe um fallback; se AudioDecoder/WebCodecs funciona em
   offscreen document.
3. **Verifique se os trechos de código propostos nos planos são consistentes com
   o código existente** (nomes de funções/variáveis, fluxo de mensagens
   background↔content↔offscreen). Ex.: o plano 01 usa `activeKey`/`keyFor` — o
   contrato bate com `content.js` atual?

### B. Lacunas (o que a auditoria pode ter deixado passar)
1. Problemas reais no código que o relatório NÃO citou (procure ativamente:
   tratamento de erros, memory leaks em Maps/WeakMaps, service worker lifetime
   vs. promises longas, race conditions no port do offscreen, segurança da chave
   de API em `chrome.storage.local`, LGPD/privacidade no modo nuvem, i18n,
   acessibilidade dos cards Shadow DOM).
2. Riscos dos planos não documentados (ex.: plano 05 — o esquema de pareamento
   `/pair` proposto é seguro contra um site malicioso que chega primeiro? plano
   03 — WebGPU em offscreen document tem limitações conhecidas?).
3. Impacto em `scripts/pack-extension.mjs` e no zip distribuído pelo site
   (algum plano exige novo arquivo vendor/ ou mudança de manifest?).

### C. Qualidade dos planos
1. Cada plano é **implementável por outro agente sem contexto adicional**?
   Faltam decisões, ordens de passo, ou critérios ambíguos?
2. Os critérios de aceite são testáveis? As verificações propostas são
   executáveis de verdade (ex.: "simular cota" — como exatamente)?
3. A ordem/dependência no roadmap está correta? Alguma parte deveria ser
   dividida ou juntada?
4. Conflitos entre partes (ex.: plano 01 e 04 mexem em `content.js`; plano 06
   mexe em tudo — a ordem recomendada evita retrabalho?).

## Restrições

- NÃO modifique nenhum arquivo. Produza apenas um relatório.
- Baseie cada afirmação em evidência (cite arquivo:linha do código ou dos
  planos). Se não puder verificar algo, marque como "não verificado" e explique
  o porquê.
- Ignore o site `src/` exceto onde os planos o mencionam.

## Formato de saída (obrigatório)

```
REVISÃO DA AUDITORIA E PLANOS VOZCLARA

1. VEREDITO GERAL (aprovado / aprovado com ressalvas / precisa correção)

2. ERROS FACTUAIS (afirmações falsas ou imprecisas)
   - [DOC] documento, seção | [EVIDÊNCIA] arquivo:linha real | [CORREÇÃO proposta]

3. AFIRMAÇÕES NÃO VERIFICÁVEIS
   - lista com motivo

4. LACUNAS — problemas no código que a auditoria não citou
   - [SEVERIDADE] arquivo:linha — descrição — em qual parte do plano caberia

5. RISCOS DOS PLANOS
   - por plano (01..07): o que pode falhar na execução

6. QUALIDADE DOS PLANOS
   - ambiguidades, critérios fracos, dependências erradas no roadmap

7. TOP 5 CORREÇÕES PRIORITÁRIAS nos documentos (ordenadas)
```

## Critério de pronto

O relatório só está pronto quando: (a) todos os achados A1–A3 e M1–M7 tiverem
sido conferidos contra o código, (b) você tiver procurado ativamente por pelo
menos 3 lacunas novas (mesmo que conclua que não há), e (c) os 7 planos tiverem
recebido um parecer individual de uma linha.
