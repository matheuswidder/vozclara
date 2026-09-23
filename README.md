# VozClara — áudios do WhatsApp em texto

Extensão para Chromium que transcreve mensagens de voz do WhatsApp Web e mostra o texto na própria conversa. Um clique com o botão direito no áudio → **Transcrever** → o texto aparece no chat.

🌐 Site oficial: **https://vozclara-whats.vercel.app/**

> 🤖 **Repositório desenvolvido 100% por IA**, com Grok 4.6, DeepSeek V4.1 Flash, Mimo V2.6 Flash e Muse Spark 1.3 Contributor. Tudo começou no Grok — nenhuma linha foi escrita manualmente por humanos.

## Como funciona

A transcrição acontece em **três modos**, nesta ordem de privacidade:

| Modo | Onde o áudio é processado | Sai da sua máquina? |
|---|---|---|
| **Whisper neste Chrome** (padrão) | Modelo Whisper (Turbo ~560 MB ou Small ~120 MB) rodando dentro do navegador via Transformers.js + ONNX Runtime (WebGPU/WASM) | **Não.** 100% local, zero rede |
| **Motor local** (Windows) | Servidor Python em `127.0.0.1:8173` com Whisper local, pareado por token | **Não.** 100% local, zero rede |
| **Nuvem** (opt-in) | OpenAI, Google Gemini, Groq ou xAI, com **sua própria chave** guardada só no seu navegador | Sim, somente se você optar e colar sua chave |

Nos modos locais, **nenhum byte de áudio sai do seu computador**: sem telemetria, sem conta, sem servidor intermediário. As chaves de nuvem ficam em `chrome.storage` local e nunca passam por este repositório.

## Instalação rápida

**Extensão (Chrome, Brave ou Edge no computador):**

1. Baixe `public/vozclara.zip` (ou no site) e extraia — não aponte o Chrome para o `.zip`.
2. Abra `chrome://extensions`, ative o **modo do desenvolvedor** e clique em **Carregar sem compactação**, escolhendo a pasta que contém o `manifest.json`.
3. Clique no ícone da VozClara → **Baixar Whisper** (baixa o modelo uma vez, ~560 MB).
4. Abra `web.whatsapp.com`, clique com o botão direito num áudio → **Transcrever**.

Detalhes e solução de problemas em [`extension/LEIA-ME.txt`](extension/LEIA-ME.txt).

**Motor local (Windows, opcional/legado):** rode `vozclara-local/VozClara-Motor-Setup.exe` uma vez — instala o servidor Python com ícone na bandeja. Veja [`vozclara-local/LEIA-ME.txt`](vozclara-local/LEIA-ME.txt).

## Estrutura do repositório

```text
extension/            Extensão Chrome MV3 (content scripts, offscreen Whisper, popup)
  vendor/             Transformers.js + ONNX Runtime empacotados (sem bundler)
vozclara-local/       Motor Python local + instalador Windows (.bat/.command)
tools/vozclara-setup/ Setup do motor em Go (bandeja) — gera o .exe
src/                  Site (TanStack Start + React 19 + Tailwind): demo, instalar, chaves
  lib/transcribe.ts   Relé server-side p/ demonstração com chave da plataforma (com limite)
  lib/demo-chat.ts    Conversas fictícias da demonstração (nenhum dado real)
public/               Zips distribuíveis (vozclara.zip, VozClara-Motor.zip) + demos
scripts/              Build, smoke test de navegador, empacotamento, migrações
screenshots/          Capturas do produto (todas com dados fictícios)
migrations/           Migrações SQL (auth opt-in, desligado por padrão)
```

## Desenvolvimento

```bash
npm run dev          # site em http://0.0.0.0:8080
npm run build        # build de produção (+ migrações)
npm run typecheck    # tsc --noEmit
npm test             # testes unitários (node:test)
npm run check:pack   # garante que o zip da extensão está sincronizado com o código
```

## Deploy

Produção em https://vozclara-whats.vercel.app/ via integração Git do Vercel: push na `main` publica automaticamente, cada PR ganha uma URL de preview. Nenhuma variável de ambiente é obrigatória (`XAI_API_KEY` é opcional, só para a demo do site transcrever sem chave do visitante).

Convenções: sem bundler na extensão (content scripts clássicos), Chrome 116+, EOL fixado via `.gitattributes`. Edge cases e decisões de produto vivem em `DEV/`.

## Contribuindo

Issues e pull requests são bem-vindos. Para mudanças na extensão, rode `npm run check:pack` antes de abrir o PR — o zip em `public/` precisa acompanhar o código. Para dúvidas de comportamento, inclua a versão da extensão, o navegador e se o modo era local ou nuvem.

## Privacidade em uma frase

Por padrão, tudo roda na sua máquina e nada é enviado para a rede; a nuvem só entra se você colar sua própria chave — e ela nunca sai do seu navegador.
