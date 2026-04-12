import { ConnectButton } from "@/components/ConnectButton";
import type { ServiceType } from "@/types/message";

export const dynamic = "force-dynamic";

const SERVICES: { service: ServiceType; available: boolean }[] = [
  { service: "gmail", available: true },
  { service: "slack", available: false },
  { service: "discord", available: false },
  { service: "x", available: false },
  { service: "instagram", available: false },
];

export default function ConnectPage() {
  // TODO: Fetch actual connection status from DB using session userId
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            サービス連携
          </h1>
          <a
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            ← インボックス
          </a>
        </div>
      </header>
      <main className="max-w-2xl mx-auto p-4">
        <div className="flex flex-col gap-3">
          {SERVICES.map(({ service, available }) => (
            <div key={service} className={available ? "" : "opacity-50 pointer-events-none"}>
              <ConnectButton service={service} connected={false} />
              {!available && (
                <p className="text-xs text-gray-400 mt-1 ml-1">近日対応予定</p>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
