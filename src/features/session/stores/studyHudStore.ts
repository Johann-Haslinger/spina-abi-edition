import { create } from 'zustand';
import { useMemo } from 'react';
import { useStudyAiChatStore, type StudyAiUiMode } from './studyAiChatStore';

type StudyHudState = {
  studyAiConversationKey: string | null;
  setStudyAiConversationKey: (key: string | null) => void;
};

export const useStudyHudStore = create<StudyHudState>()((set) => ({
  studyAiConversationKey: null,
  setStudyAiConversationKey: (key) => set({ studyAiConversationKey: key }),
}));

export function useStudyHudVisibility(): { studyAiMode: StudyAiUiMode; suppressNonStudyAi: boolean } {
  const key = useStudyHudStore((s) => s.studyAiConversationKey);

  const mode = useStudyAiChatStore((s) => {
    if (!key) return 'button';
    return s.uiByConversation[key]?.mode ?? 'button';
  });

  return useMemo(() => {
    const suppressNonStudyAi = mode === 'center' || mode === 'overlay';
    return { studyAiMode: mode, suppressNonStudyAi };
  }, [mode]);
}

