"use client";

import type { ServiceType } from "@/types/message";
import { getServiceLabel, getServiceColor } from "@/components/ServiceIcon";

const SERVICES: ServiceType[] = ["gmail", "slack", "discord", "x", "instagram"];

export function FilterBar({
  active,
  onFilterChange,
}: {
  active: ServiceType | null;
  onFilterChange: (service: ServiceType | null) => void;
}) {
  return (
    <div className="flex gap-1 p-2 border-b border-gray-200 overflow-x-auto">
      <FilterTab
        label="すべて"
        isActive={active === null}
        onClick={() => onFilterChange(null)}
      />
      {SERVICES.map((service) => (
        <FilterTab
          key={service}
          label={getServiceLabel(service)}
          color={getServiceColor(service)}
          isActive={active === service}
          onClick={() => onFilterChange(active === service ? null : service)}
        />
      ))}
    </div>
  );
}

function FilterTab({
  label,
  color,
  isActive,
  onClick,
}: {
  label: string;
  color?: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        isActive
          ? "text-white"
          : "text-gray-600 bg-gray-100 hover:bg-gray-200"
      }`}
      style={
        isActive
          ? { backgroundColor: color ?? "#3B82F6" }
          : undefined
      }
    >
      {label}
    </button>
  );
}
