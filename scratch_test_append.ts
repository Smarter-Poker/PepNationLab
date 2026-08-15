import { create } from 'zustand';

const useMessengerStore = create<any>((set, get) => ({
  messages: {},
  appendMessage: (convId, msg) =>
    set((s) => {
      const list = s.messages[convId] ?? [];
      if (list.some((m) => m.id === msg.id)) return s;
      
      if (msg.client_message_id) {
        const existingIdx = list.findIndex(m => m.client_message_id === msg.client_message_id);
        if (existingIdx !== -1) {
          const newList = [...list];
          newList[existingIdx] = msg;
          return { messages: { ...s.messages, [convId]: newList } };
        }
      }
      return { messages: { ...s.messages, [convId]: [...list, msg] } };
    }),
}));

useMessengerStore.getState().appendMessage('123', { id: 'uuid-1', text: 'hello' });
console.log(useMessengerStore.getState().messages['123'].length); // 1
useMessengerStore.getState().appendMessage('123', { id: 'uuid-1', text: 'hello' });
console.log(useMessengerStore.getState().messages['123'].length); // should be 1
