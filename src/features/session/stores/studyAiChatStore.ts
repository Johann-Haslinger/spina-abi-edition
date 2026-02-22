import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { newId } from '../../../lib/id';

export type StudyAiRole = 'user' | 'assistant';

export type StudyAiMessage = {
  id: string;
  role: StudyAiRole;
  content: string;
  createdAtMs: number;
};

export type StudyAiUiMode = 'button' | 'center' | 'overlay' | 'floating';

type ConversationState = {
  messages: StudyAiMessage[];
  docId: string | null;
};

type ConversationUiState = {
  mode: StudyAiUiMode;
};

type StudyAiChatState = {
  conversations: Record<string, ConversationState | undefined>;
  uiByConversation: Record<string, ConversationUiState | undefined>;

  ensureConversation: (conversationKey: string) => void;
  getConversation: (conversationKey: string) => ConversationState;
  getUi: (conversationKey: string) => ConversationUiState;

  setUiMode: (conversationKey: string, mode: StudyAiUiMode) => void;

  append: (conversationKey: string, msg: Omit<StudyAiMessage, 'id' | 'createdAtMs'>) => void;
  setDocId: (conversationKey: string, docId: string | null) => void;
  clearConversation: (conversationKey: string) => void;
};

const defaultUi: ConversationUiState = { mode: 'button' };
const defaultConversation: ConversationState = { messages: [], docId: null };

export const useStudyAiChatStore = create<StudyAiChatState>()(
  persist(
    (set, get) => ({
      conversations: {},
      uiByConversation: {},

      ensureConversation: (conversationKey) =>
        set((s) => {
          const has = Boolean(s.conversations[conversationKey]);
          const hasUi = Boolean(s.uiByConversation[conversationKey]);
          if (has && hasUi) return s;
          return {
            conversations: {
              ...s.conversations,
              [conversationKey]: has ? s.conversations[conversationKey] : defaultConversation,
            },
            uiByConversation: {
              ...s.uiByConversation,
              [conversationKey]: hasUi ? s.uiByConversation[conversationKey] : defaultUi,
            },
          };
        }),

      getConversation: (conversationKey) =>
        get().conversations[conversationKey] ?? defaultConversation,
      getUi: (conversationKey) => get().uiByConversation[conversationKey] ?? defaultUi,

      setUiMode: (conversationKey, mode) =>
        set((s) => ({
          uiByConversation: {
            ...s.uiByConversation,
            [conversationKey]: { ...(s.uiByConversation[conversationKey] ?? defaultUi), mode },
          },
        })),

      append: (conversationKey, msg) =>
        set((s) => {
          const current = s.conversations[conversationKey] ?? defaultConversation;
          const next: StudyAiMessage = { id: newId(), createdAtMs: Date.now(), ...msg };
          return {
            conversations: {
              ...s.conversations,
              [conversationKey]: { ...current, messages: [...current.messages, next] },
            },
          };
        }),

      setDocId: (conversationKey, docId) =>
        set((s) => ({
          conversations: {
            ...s.conversations,
            [conversationKey]: {
              ...(s.conversations[conversationKey] ?? defaultConversation),
              docId,
            },
          },
        })),

      clearConversation: (conversationKey) =>
        set((s) => ({
          conversations: {
            ...s.conversations,
            [conversationKey]: {
              ...(s.conversations[conversationKey] ?? defaultConversation),
              messages: [],
              docId: null,
            },
          },
        })),
    }),
    {
      name: 'mathe-abi-2026:study-ai-chat',
      partialize: (s) => ({
        conversations: s.conversations,
        uiByConversation: s.uiByConversation,
      }),
    },
  ),
);
