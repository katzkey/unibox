"use client";

import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { ServiceIcon } from "@/components/ServiceIcon";
import type { UnifiedMessage } from "@/types/message";

export function MessageCard({ message }: { message: UnifiedMessage }) {
  const handleOpen = () => {
    window.open(message.openUrl, "_blank");
  };

  return (
    <button
      onClick={handleOpen}
      className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors flex gap-3 ${
        message.isRead ? "opacity-70" : ""
      }`}
    >
      <ServiceIcon service={message.source} size={32} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {!message.isRead && (
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            )}
            <span className="font-medium text-sm truncate">
              {message.sender.displayName}
            </span>
            {message.channel && (
              <span className="text-xs text-gray-400 truncate">
                #{message.channel}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
            {formatDistanceToNow(new Date(message.timestamp), {
              addSuffix: true,
              locale: ja,
            })}
          </span>
        </div>
        {message.subject && (
          <p className="text-sm font-medium text-gray-800 truncate mt-0.5">
            {message.subject}
          </p>
        )}
        <p className="text-sm text-gray-500 truncate mt-0.5">
          {message.bodyText}
        </p>
      </div>
    </button>
  );
}
