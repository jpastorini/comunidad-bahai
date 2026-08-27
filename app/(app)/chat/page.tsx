import { ChatTopicPage } from "./topic-page";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  return <ChatTopicPage topic="secretaria" />;
}
