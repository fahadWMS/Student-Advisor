import { Suspense } from "react";
import { ChatInterface } from "@/components/chat/ChatInterface";

function ChatPageContent() {
  return <ChatInterface />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading chat...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}
