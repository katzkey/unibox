"use client";

import type { ServiceType } from "@/types/message";
import { ServiceIcon, getServiceLabel } from "@/components/ServiceIcon";

export function ConnectButton({
  service,
  connected,
}: {
  service: ServiceType;
  connected: boolean;
}) {
  const handleConnect = () => {
    // X service uses "twitter" as the route name
    const routeName = service === "x" ? "twitter" : service;
    window.location.href = `/api/connect/${routeName}`;
  };

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex items-center gap-3">
        <ServiceIcon service={service} size={36} />
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {getServiceLabel(service)}
          </p>
          <p className="text-xs text-gray-500">
            {connected ? "接続済み" : "未接続"}
          </p>
        </div>
      </div>
      {connected ? (
        <span className="text-sm text-green-600 font-medium">✓ 連携中</span>
      ) : (
        <button
          onClick={handleConnect}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          連携する
        </button>
      )}
    </div>
  );
}
