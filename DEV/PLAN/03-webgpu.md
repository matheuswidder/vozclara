# Parte 3 — Habilitar WebGPU real no Whisper

**Resolve**: A2 (velocidade de transcrição 10–50x em máquinas com GPU).

**Depende de**: nada. **Antes da**: Parte 1 (mesmo `offscreen.js` — fazer
`hasWebGPU` antes dos emits de fase). Um agente sozinho: sequência canônica
em `DEV/PLAN/00-ROADMAP.md` (2 → 3 → 5 → 1 → …).

## Problema atual

- `offscreen.js:161-163`:
  ```js
  async function hasWebGPU() {
    return false;
  }
  ```
- Consequência: `attempts()` nunca tenta `webgpu`; toda inferência roda em
  `wasm` (q4/q8). Em um áudio de 1 minuto, o large-v3-turbo q4 em WASM pode levar
  **minutos**; com WebGPU, **segundos**.
- O bundle `vendor/ort.webgpu.bundle.min.mjs` já está presente — o suporte só está
  desligado na função.

## Por que estava desligado (contexto)

Provavelmente por instabilidade do ORT WebGPU em alguns drivers. A correção segura
não é ligar indiscriminadamente, mas **detectar + validar + cair para WASM com
graceful degradation** — o loop de `attempts()` já faz fallback por tentativa.

## Implementação

**Arquivo**: `extension/offscreen.js`

### 3.1 Detecção real

```js
async function hasWebGPU() {
  try {
    if (!self.navigator?.gpu) return false;
    const adapter = await self.navigator.gpu.requestAdapter();
    if (!adapter) return false;
    // limite conservador: GPU integrada atende; offscreen herda o mesmo adapter
    return adapter.features?.size > 0;
  } catch {
    return false;
  }
}
```

### 3.2 Cache da detecção

- Guardar resultado em variável de módulo (o offscreen vive enquanto o documento
  viver) e, opcionalmente, em `chrome.storage.session` para não re-detectar a cada
  service worker restart (a função só roda no offscreen, então cache de módulo basta).

### 3.3 Ordem de tentativas (já existente, conferir)

`attempts(true)` já tenta `webgpu q4f16 → webgpu q4 → wasm q4`. Manter.
`attempts(false)` mantém `wasm q4 → wasm q8`. Manter.

### 3.4 Instrumentação

- Ao carregar com sucesso em webgpu, o `emit()` já informa `device`.
  `persistProgress` hoje **não** grava `device` (`background.js:165-176`);
  `storedStatus` já lê `localModelDevice`. Gravar `localModelDevice` no
  persist para dock/popup mostrarem "Pronto · modelo · webgpu".
- Se todas as tentativas webgpu falharem, o loop já cai em wasm; garantir que a
  mensagem final não mencione erro de webgpu (o erro só aparece se TUDO falhar).

### 3.5 (Opcional, parte do mesmo PR) heuristic de memória

- Para `v3` (~1,5 GB) em GPU com `adapter.limits.maxBufferSize` baixo, preferir
  `q4` sobre `q4f16`. Só implementar se houver relato de falha com q4f16.

## Critérios de aceite

- [ ] Em Chrome com GPU compatível: `device === "webgpu"` no estado final e badge
      dock/popup mostram isso.
- [ ] Em Chrome sem WebGPU: comportamento idêntico ao atual (wasm).
- [ ] Se webgpu falhar no load, cai em wasm automaticamente (sem erro ao usuário).

## Verificação

1. `chrome://gpu` → confirmar WebGPU ativo na máquina de teste.
2. Transcrever áudio de ~1 min com modelo turbo → comparar tempo antes/depois.
3. Desabilitar WebGPU em `chrome://flags` (ou testar em Firefox-less Edge antigo) →
   confirmar fallback wasm sem erro.

## Riscos

- Drivers de GPU instáveis podem produzir resultado errado silenciosamente (raro,
  documentado no ORT). Mitigação: se houver relato, voltar `hasWebGPU()` para
  `false` é uma linha.
- `q4f16` é mais agressivo que `q4` — se houver falha apenas com f16, reordenar
  attempts para `q4 → q4f16 → wasm`.
