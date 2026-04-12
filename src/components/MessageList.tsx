"use client";

import { useState } from "react";
import { MessageCard } from "@/components/MessageCard";
import { FilterBar } from "@/components/FilterBar";
import type { ServiceType, UnifiedMessage } from "@/types/message";

export function MessageList({ messages }: { messages: UnifiedMessage[] }) {
  const [filter, setFilter] = useState<ServiceType | null>(null);

  const filtered = filter
    ? messages.filter((m) => m.source === filter)
    : messages;

  return (
    <div className="flex flex-col h-full">
      <FilterBar active={filter} onFilterChange={setFilter} />
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            {filter
              ? `${filter} のメッセージはありません`
              : "メッセージはありません"}
          </div>
        ) : (
          filtered.map((msg) => (
            <MessageCard key={msg.id} message={msg} />
          ))
        )}
      </div>
    </div>
  );
}
