import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  messages: [],
  currentSession: null,
  isTyping: false,

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...message,
    }],
  })),

  setMessages: (messages) => set({ messages }),

  clearMessages: () => set({ messages: [] }),

  setCurrentSession: (session) => set({ currentSession: session }),

  setIsTyping: (isTyping) => set({ isTyping }),

  getConversationHistory: () => {
    const { messages } = get();
    return messages.map(({ sender, text }) => ({ sender, text }));
  },
}));
