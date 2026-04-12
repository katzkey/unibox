import type { ServiceType } from "@/types/message";

const SERVICE_CONFIG: Record<ServiceType, { label: string; color: string; icon: string }> = {
  gmail: { label: "Gmail", color: "#EA4335", icon: "✉" },
  slack: { label: "Slack", color: "#4A154B", icon: "💬" },
  discord: { label: "Discord", color: "#5865F2", icon: "🎮" },
  x: { label: "X", color: "#000000", icon: "𝕏" },
  instagram: { label: "Instagram", color: "#E4405F", icon: "📷" },
  line: { label: "LINE", color: "#06C755", icon: "💚" },
};

export function ServiceIcon({
  service,
  size = 24,
}: {
  service: ServiceType;
  size?: number;
}) {
  const config = SERVICE_CONFIG[service];

  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: config.color,
        fontSize: size * 0.5,
        lineHeight: 1,
      }}
      title={config.label}
    >
      <span className="text-white">{config.icon}</span>
    </span>
  );
}

export function getServiceLabel(service: ServiceType): string {
  return SERVICE_CONFIG[service].label;
}

export function getServiceColor(service: ServiceType): string {
  return SERVICE_CONFIG[service].color;
}
