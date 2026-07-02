import { Wifi, WifiOff, Bluetooth, Settings, Battery, BatteryLow, BatteryWarning, BatteryCharging } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";

interface StatusBarProps {
  onSettingsClick: () => void;
  onWifiClick?: () => void;
  onBluetoothClick?: () => void;
  isWifiConnected: boolean;
  wifiSsid?: string;
  isBluetoothConnected: boolean;
  batteryLevel: number; // 0-100, -1 when unknown
  isCharging?: boolean;
}

export function StatusBar({ onSettingsClick, onWifiClick, onBluetoothClick, isWifiConnected, wifiSsid, isBluetoothConnected, batteryLevel, isCharging }: StatusBarProps) {
  const [time, setTime] = useState(new Date());
  const [showBatteryWarning, setShowBatteryWarning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setShowBatteryWarning(batteryLevel >= 0 && batteryLevel < 20 && !isCharging);
  }, [batteryLevel, isCharging]);

  const getBatteryIcon = () => {
    if (isCharging) return <BatteryCharging className="w-4 h-4 text-[oklch(72%_0.19_142)]" />;
    if (batteryLevel < 0) return <Battery className="w-4 h-4 text-[oklch(60%_0_0)]" />;
    if (batteryLevel < 15) return <BatteryWarning className="w-4 h-4 text-[oklch(63.7%_0.237_25.331)]" />;
    if (batteryLevel < 20) return <BatteryLow className="w-4 h-4 text-[oklch(82.8%_0.189_84.429)]" />;
    return <Battery className="w-4 h-4 text-[oklch(60%_0_0)]" />;
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-10 z-50"
        style={{ background: "linear-gradient(to bottom, oklch(11% 0 0) 60%, transparent)" }}
      >
        {/* Brand */}
        <div className="flex items-baseline gap-2">
          <span className="text-[oklch(97%_0_0)] tracking-tight" style={{ fontWeight: 700, fontSize: "1.375rem" }}>
            OpenPanel
          </span>
          <span className="text-[oklch(38%_0_0)] tracking-widest uppercase" style={{ fontSize: "0.6rem", fontWeight: 500 }}>
            by Orgista™
          </span>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-5">
          {/* Time */}
          <span className="text-[oklch(75%_0_0)]" style={{ fontWeight: 400, fontSize: "0.9375rem" }}>
            {formatTime(time)}
          </span>

          {/* System icons */}
          <div className="flex items-center gap-1">
            <motion.button
              onClick={onWifiClick || onSettingsClick}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.93 }}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
              title={isWifiConnected ? `Wi-Fi: ${wifiSsid ?? "connected"}` : "Wi-Fi disconnected"}
            >
              {isWifiConnected
                ? <Wifi className="w-4 h-4 text-[oklch(75%_0_0)]" />
                : <WifiOff className="w-4 h-4 text-[oklch(43%_0_0)]" />
              }
            </motion.button>

            <motion.button
              onClick={onBluetoothClick || onSettingsClick}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.93 }}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
              title={isBluetoothConnected ? "Bluetooth connected" : "Bluetooth disconnected"}
            >
              <Bluetooth className={`w-4 h-4 ${isBluetoothConnected ? "text-[oklch(75%_0_0)]" : "text-[oklch(43%_0_0)]"}`} />
            </motion.button>

            <div className="flex items-center gap-1 ml-1">
              {getBatteryIcon()}
              <span
                className={`text-xs ${batteryLevel >= 0 && batteryLevel < 20 && !isCharging ? "text-[oklch(82.8%_0.189_84.429)]" : "text-[oklch(50%_0_0)]"}`}
                style={{ fontWeight: 500 }}
              >
                {batteryLevel >= 0 ? `${batteryLevel}%` : "—"}
              </span>
            </div>
          </div>

          {/* Settings */}
          <motion.button
            onClick={onSettingsClick}
            whileHover={{ scale: 1.1, rotate: 45 }}
            whileTap={{ scale: 0.93 }}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
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
