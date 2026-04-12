"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageList } from "@/components/MessageList";
import { getUserIdFromClient } from "@/lib/get-user-id";
import type { UnifiedMessage } from "@/types/message";

export default function Home() {
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setUserId(getUserIdFromClient());
  }, []);

  const loadMessages = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/messages?userId=${encodeURIComponent(userId)}&limit=50`);
      if (res.ok) {
        const data = (await res.json()) as { messages: UnifiedMessage[] };
        setMessages(data.messages);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchNewMessages = useCallback(async () => {
    if (!userId) return;
    setFetching(true);
    try {
      // Trigger fetch from all connected services
      const res = await fetch("/api/messages/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        // Reload messages from DB after fetch
        await loadMessages();
      } else {
        const data = await res.json();
        console.error("Fetch failed:", data.error);
      }
    } catch (error) {
      console.error("Failed to fetch new messages:", error);
    } finally {
      setFetching(false);
    }
  }, [userId, loadMessages]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            UniBox
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchNewMessages}
              disabled={fetching}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {fetching ? "取得中..." : "メール取得"}
            </button>
            <a
              href="/connect"
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              サービス連携
            </a>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto">
        {!userId ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm gap-3">
            <p>サービスを連携してください</p>
            <a
              href="/connect"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              サービス連携へ
            </a>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            読み込み中...
          </div>
        ) : (
          <MessageList messages={messages} />
        )}
      </main>
    </div>
  );
}
