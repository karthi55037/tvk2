'use client';

import { TopBar } from '@/components/nav';
import { ChatView } from '@/components/chat';

export default function ClassChatPage() {
  return (
    <>
      <TopBar title="Class Chat" />
      <ChatView endpoint="/api/chat/class" topic="chat:CLASS:class" emojiBan />
    </>
  );
}
