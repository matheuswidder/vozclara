export type ChatMessage =
  | {
      id: string;
      kind: "text";
      from: "in" | "out";
      time: string;
      text: string;
    }
  | {
      id: string;
      kind: "voice";
      from: "in" | "out";
      time: string;
      src: string;
      duration: number;
      seed: number;
      transcript: string;
    };

export type DemoChat = {
  id: string;
  name: string;
  initials: string;
  preview: string;
  time: string;
  unread: number;
  status: string;
  messages: ChatMessage[];
};

export const DEMO_CHATS: DemoChat[] = [
  {
    id: "marina",
    name: "Marina",
    initials: "MA",
    preview: "0:09",
    time: "18:42",
    unread: 2,
    status: "online",
    messages: [
      {
        id: "m1",
        kind: "text",
        from: "in",
        time: "18:40",
        text: "Você vai passar no mercado?",
      },
      {
        id: "m2",
        kind: "voice",
        from: "in",
        time: "18:41",
        src: "/demo/mercado.mp3",
        duration: 9,
        seed: 41,
        transcript:
          "Oi, passa no mercado se puder. Precisa de leite, pão, ovos e aquele queijo prato que a gente gosta. Se não tiver, o mussarela serve.",
      },
      {
        id: "m3",
        kind: "text",
        from: "out",
        time: "18:41",
        text: "Tô saindo agora",
      },
      {
        id: "m4",
        kind: "voice",
        from: "in",
        time: "18:42",
        src: "/demo/cafe.mp3",
        duration: 10,
        seed: 77,
        transcript:
          "Espera, e também café. O pacote acabou ontem. Ah, e se o pão francês estiver fresco, pega uns seis. Valeu, te vejo daqui a pouco.",
      },
    ],
  },
  {
    id: "escritorio",
    name: "Escritório",
    initials: "ES",
    preview: "0:09",
    time: "17:18",
    unread: 1,
    status: "visto por último hoje às 17:20",
    messages: [
      {
        id: "e1",
        kind: "text",
        from: "in",
        time: "17:12",
        text: "Consegue olhar o áudio? Estou no trânsito.",
      },
      {
        id: "e2",
        kind: "voice",
        from: "in",
        time: "17:18",
        src: "/demo/reuniao.mp3",
        duration: 9,
        seed: 19,
        transcript:
          "A reunião com o cliente ficou para terça às duas. Leva o deck atualizado, o da semana passada já não vale. Qualquer coisa me chama.",
      },
      {
        id: "e3",
        kind: "text",
        from: "out",
        time: "17:19",
        text: "Ouvi. Já anoto.",
      },
    ],
  },
];
