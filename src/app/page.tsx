import { prisma } from "@/lib/db";
import { MessageList } from "@/components/MessageList";
import type { UnifiedMessage } from "@/types/message";

export const dynamic = "force-dynamic";

export default async function Home() {
  // TODO: Replace with actual auth session userId
  // For now, fetch all messages for display
  const rows = await prisma.message.findMany({
    orderBy: { fetchedAt: "desc" },
    take: 50,
  });

  const messages: UnifiedMessage[] = rows.map((row) => {
    const data = JSON.parse(row.data) as UnifiedMessage;
    return {
      ...data,
      id: row.id,
      isRead: row.isRead,
      timestamp: new Date(data.timestamp),
    };
  });

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            UniBox
          </h1>
          <a
            href="/connect"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            サービス連携
          </a>
        </div>
      </header>
      <main className="max-w-2xl mx-auto">
        <MessageList messages={messages} />
      </main>
    </div>
  );
}
