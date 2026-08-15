import { Wifi, WifiOff, Bluetooth, Settings, BatteryLow } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { OpenPanelBrand } from "./OpenPanelBrand";

interface StatusBarProps {
  onSettingsClick: () => void;
  onWifiClick?: () => void;
  onBluetoothClick?: () => void;
  isWifiConnected: boolean;
  wifiSsid?: string;
  isBluetoothConnected: boolean;
  batteryLevel: number; // 0-100, -1 when unknown
  isCharging?: boolean;
  showBattery?: boolean;
}

const SYSTEM_BUTTON_CLASSES = "w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80";

const BATTERY_COLORS = {
  white: "#ffffff",
  yellow: "#ffd60a",
  red: "#ff453a",
  unknown: "#6b7280",
} as const;

function BatteryIndicator({ level, isCharging }: { level: number; isCharging?: boolean }) {
  const hasLevel = level >= 0;
  const fillLevel = hasLevel ? Math.min(100, Math.max(0, level)) : 0;
  const tone = !hasLevel ? "unknown" : fillLevel >= 40 ? "white" : fillLevel >= 20 ? "yellow" : "red";
  const color = BATTERY_COLORS[tone];
  const label = hasLevel
    ? `Battery ${fillLevel}%${isCharging ? ", charging" : ""}`
    : `Battery level unknown${isCharging ? ", charging" : ""}`;

  return (
    <span className="inline-flex items-center" aria-label={label} title={label}>
      <svg
        viewBox="0 0 30 14"
        className="h-2.5 w-[21px] overflow-visible"
        data-battery-gauge="true"
        aria-hidden="true"
      >
        <rect
          x="0.75"
          y="0.75"
          width="25.5"
          height="12.5"
          rx="3.5"
          fill="none"
          stroke={hasLevel ? color : BATTERY_COLORS.unknown}
          strokeWidth="1.5"
        />
        <path
          d="M27.5 4.5C28.65 4.85 29.25 5.7 29.25 7s-.6 2.15-1.75 2.5V4.5Z"
          fill={hasLevel ? color : BATTERY_COLORS.unknown}
        />
        <svg x="3" y="3" width="20.5" height="8" viewBox="0 0 100 8" preserveAspectRatio="none">
          <rect
            x="0"
            y="0"
            width={fillLevel}
            height="8"
            rx="1.5"
            fill={color}
            data-battery-tone={tone}
            data-battery-fill={fillLevel}
            className="transition-all duration-300"
          />
        </svg>
        {isCharging && (
          <path
            d="M15.3 2.8 10.8 7.5h3l-1.1 3.7 4.5-4.9h-3.05l1.15-3.5Z"
            fill="#09090b"
            stroke="#ffffff"
            strokeWidth="0.45"
            strokeLinejoin="round"
            data-charging-bolt="true"
          />
        )}
      </svg>
    </span>
  );
}

export function StatusBar({ onSettingsClick, onWifiClick, onBluetoothClick, isWifiConnected, wifiSsid, isBluetoothConnected, batteryLevel, isCharging, showBattery = true }: StatusBarProps) {
  const [time, setTime] = useState(new Date());
  const [showBatteryWarning, setShowBatteryWarning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setShowBatteryWarning(showBattery && batteryLevel >= 0 && batteryLevel < 20 && !isCharging);
  }, [batteryLevel, isCharging, showBattery]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  const wifiLabel = isWifiConnected ? `Wi-Fi: ${wifiSsid ?? "connected"}` : "Wi-Fi disconnected";
  const bluetoothLabel = isBluetoothConnected ? "Bluetooth connected" : "Bluetooth disconnected";

  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-10 z-50"
        style={{ background: "linear-gradient(to bottom, oklch(11% 0 0) 60%, transparent)" }}
      >
        {/* Brand */}
        <OpenPanelBrand />

        {/* Right cluster */}
        <div className="flex items-center gap-5">
          {/* Time */}
          <span className="text-[oklch(75%_0_0)]" style={{ fontWeight: 400, fontSize: "0.9375rem" }}>
            {formatTime(time)}
          </span>

          {/* System icons */}
          <div className="flex items-center gap-1">
            <motion.button
              type="button"
              onClick={onWifiClick || onSettingsClick}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.93 }}
              className={SYSTEM_BUTTON_CLASSES}
              aria-label={wifiLabel}
              title={wifiLabel}
            >
              {isWifiConnected
                ? <Wifi className="w-4 h-4 text-[oklch(75%_0_0)]" />
                : <WifiOff className="w-4 h-4 text-[oklch(43%_0_0)]" />
              }
            </motion.button>

            <motion.button
              type="button"
              onClick={onBluetoothClick || onSettingsClick}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.93 }}
              className={SYSTEM_BUTTON_CLASSES}
              aria-label={bluetoothLabel}
              title={bluetoothLabel}
            >
              <Bluetooth className={`w-4 h-4 ${isBluetoothConnected ? "text-[oklch(75%_0_0)]" : "text-[oklch(43%_0_0)]"}`} />
            </motion.button>

            {showBattery && (
              <div className="h-8 flex items-center gap-1">
                <BatteryIndicator level={batteryLevel} isCharging={isCharging} />
                <span
                  className="text-xs"
                  style={{
                    color: batteryLevel < 0
                      ? BATTERY_COLORS.unknown
                      : BATTERY_COLORS[batteryLevel >= 40 ? "white" : batteryLevel >= 20 ? "yellow" : "red"],
                    fontWeight: 500,
                  }}
                >
                  {batteryLevel >= 0 ? `${batteryLevel}%` : "—"}
                </span>
              </div>
            )}
          </div>

          {/* Settings */}
          <motion.button
            type="button"
            onClick={onSettingsClick}
            whileHover={{ scale: 1.1, rotate: 45 }}
            whileTap={{ scale: 0.93 }}
            className={SYSTEM_BUTTON_CLASSES}
            aria-label="Open settings"
            title="Open settings"
          >
            <Settings className="w-4 h-4 text-[oklch(55%_0_0)]" />
          </motion.button>
        </div>
      </div>

      {/* Low battery toast */}
      <AnimatePresence>
        {showBatteryWarning && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed top-20 right-10 z-[60] bg-[oklch(18%_0_0)] border border-[oklch(82.8%_0.189_84.429)]/40 px-4 py-2.5 rounded-lg flex items-center gap-2.5"
          >
            <BatteryLow className="w-4 h-4 text-[oklch(82.8%_0.189_84.429)]" />
            <span className="text-[oklch(87%_0_0)] text-sm" style={{ fontWeight: 500 }}>
              Low battery — please charge soon
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
