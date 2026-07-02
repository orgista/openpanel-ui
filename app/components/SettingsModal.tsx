import { motion, AnimatePresence } from "motion/react";
import { X, Wifi, Bluetooth, LogOut, Shield, RefreshCw, ExternalLink, Loader2, Lock, LayoutGrid } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { AdminAuth } from "./AdminAuth";
import { SystemBridge, type WifiNetwork, type BtDevice } from "../native/SystemBridge";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isStandalone: boolean;
  onExitKiosk: () => void;
  isAdmin: boolean;
  onEnterAdmin: () => void;
  onExitAdmin: () => void;
  onOpenAdminPanel: () => void;
  initialTab?: "wifi" | "bluetooth";
  onNetworkChange?: () => void;
}

type ConnectState =
  | { phase: "idle" }
  | { phase: "password"; ssid: string }
  | { phase: "connecting"; ssid: string }
  | { phase: "pending-approval"; ssid: string }
  | { phase: "failed"; ssid: string; message: string };

export function SettingsModal({
  isOpen,
  onClose,
  isStandalone,
  onExitKiosk,
  isAdmin,
  onEnterAdmin,
  onExitAdmin,
  onOpenAdminPanel,
  initialTab = "wifi",
  onNetworkChange,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"wifi" | "bluetooth">(initialTab);
  const [showAdminAuth, setShowAdminAuth] = useState(false);

  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [wifiScanning, setWifiScanning] = useState(false);
  const [wifiError, setWifiError] = useState<string | null>(null);
  const [connect, setConnect] = useState<ConnectState>({ phase: "idle" });
  const [password, setPassword] = useState("");

  const [btDevices, setBtDevices] = useState<BtDevice[]>([]);
  const [btEnabled, setBtEnabled] = useState<boolean | null>(null);
  const [btToggling, setBtToggling] = useState(false);
  const [btScanning, setBtScanning] = useState(false);
  const [btError, setBtError] = useState<string | null>(null);
  const [pairingAddress, setPairingAddress] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scanWifi = useCallback(async () => {
    setWifiScanning(true);
    setWifiError(null);
    try {
      const { networks: found } = await SystemBridge.scanWifi();
      found.sort((a, b) => (b.connected ? 1 : 0) - (a.connected ? 1 : 0) || b.signal - a.signal);
      setNetworks(found);
    } catch (e: any) {
      setWifiError(e?.message || "Could not scan Wi-Fi networks");
    } finally {
      setWifiScanning(false);
    }
  }, []);

  const loadBluetooth = useCallback(async () => {
    setBtError(null);
    try {
      const status = await SystemBridge.getBluetoothStatus();
      setBtEnabled(status.enabled);
      if (!status.available) {
        setBtError("Bluetooth is not available on this device");
        setBtDevices([]);
        return;
      }
      setBtDevices(status.enabled ? status.devices ?? [] : []);
    } catch (e: any) {
      setBtError(e?.message || "Could not read Bluetooth status");
    }
  }, []);

  const toggleBluetooth = useCallback(async (target: boolean) => {
    if (!isAdmin) return; // changing adapter state is an admin-only action
    setBtToggling(true);
    setBtError(null);
    try {
      // Android shows a system confirmation dialog; poll until the state
      // actually flips (user accepted) or give up after 15s.
      await SystemBridge.setBluetoothEnabled({ enabled: target });
      const started = Date.now();
      while (Date.now() - started < 15000) {
        await new Promise(r => setTimeout(r, 1500));
        const status = await SystemBridge.getBluetoothStatus();
        if (status.enabled === target) break;
      }
      await loadBluetooth();
      onNetworkChange?.();
    } catch (e: any) {
      setBtError(e?.message || "Could not change Bluetooth state");
    } finally {
      setBtToggling(false);
    }
  }, [isAdmin, loadBluetooth, onNetworkChange]);

  const scanBluetooth = useCallback(async () => {
    setBtScanning(true);
    setBtError(null);
    try {
      const { devices } = await SystemBridge.scanBluetooth();
      devices.sort(
        (a, b) =>
          (b.connected ? 2 : 0) + (b.paired ? 1 : 0) - ((a.connected ? 2 : 0) + (a.paired ? 1 : 0))
      );
      setBtDevices(devices.filter(d => !d.unnamed));
    } catch (e: any) {
      setBtError(e?.message || "Could not scan for devices");
    } finally {
      setBtScanning(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setConnect({ phase: "idle" });
      setPassword("");
      setShowAdminAuth(false);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "wifi") scanWifi();
    if (activeTab === "bluetooth") loadBluetooth();
  }, [isOpen, activeTab, scanWifi, loadBluetooth]);

  // System dialogs (Wi-Fi/Bluetooth enable, settings panels) background the
  // WebView, which throttles JS timers — so re-sync state when we return to
  // the foreground rather than relying on the in-flight poll loop.
  useEffect(() => {
    if (!isOpen) return;
    const onResume = () => {
      if (document.visibilityState !== "visible") return;
      if (activeTab === "wifi") scanWifi();
      else loadBluetooth();
      onNetworkChange?.();
    };
    document.addEventListener("visibilitychange", onResume);
    return () => document.removeEventListener("visibilitychange", onResume);
  }, [isOpen, activeTab, scanWifi, loadBluetooth, onNetworkChange]);

  // The adapter can settle into on/off well after the user taps the system
  // dialog — this native event fires exactly then, so the toggle never goes stale.
  useEffect(() => {
    let handle: { remove: () => void } | undefined;
    SystemBridge.addListener("bluetoothStateChanged", ({ enabled }) => {
      setBtEnabled(enabled);
      setBtToggling(false);
      if (enabled) loadBluetooth();
      else setBtDevices([]);
      onNetworkChange?.();
    }).then(h => { handle = h; });
    return () => handle?.remove();
  }, [loadBluetooth, onNetworkChange]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const startConnect = (network: WifiNetwork) => {
    if (!isAdmin) return; // joining a network is an admin-only action
    setPassword("");
    if (network.secured) {
      setConnect({ phase: "password", ssid: network.ssid });
    } else {
      submitConnect(network.ssid, "");
    }
  };

  const submitConnect = async (ssid: string, pass: string) => {
    if (!isAdmin) return; // joining a network is an admin-only action
    setConnect({ phase: "connecting", ssid });
    try {
      const res = await SystemBridge.connectWifi({ ssid, password: pass });
      if (res.status !== "suggested") {
        setConnect({ phase: "failed", ssid, message: "Android rejected the network request" });
        return;
      }
      // Suggestion added — Android connects on its own schedule. Poll for up to 25s.
      let waited = 0;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        waited += 2500;
        try {
          const status = await SystemBridge.getWifiStatus();
          if (status.connected && status.ssid === ssid) {
            if (pollRef.current) clearInterval(pollRef.current);
            setConnect({ phase: "idle" });
            onNetworkChange?.();
            scanWifi();
            return;
          }
        } catch { /* keep polling */ }
        if (waited >= 25000) {
          if (pollRef.current) clearInterval(pollRef.current);
          setConnect({ phase: "pending-approval", ssid });
        }
      }, 2500);
    } catch (e: any) {
      setConnect({ phase: "failed", ssid, message: e?.message || "Connection failed" });
    }
  };

  const handleForgetWifi = async (ssid: string) => {
    try {
      await SystemBridge.forgetWifi({ ssid });
      onNetworkChange?.();
      scanWifi();
    } catch { /* network not added by us — nothing to forget */ }
  };

  const handlePair = async (device: BtDevice) => {
    if (!isAdmin) return; // pairing a peripheral is an admin-only action
    setPairingAddress(device.address);
    setBtError(null);
    try {
      await SystemBridge.pairBluetooth({ address: device.address });
      await loadBluetooth();
      onNetworkChange?.();
    } catch (e: any) {
      setBtError(`Pairing with ${device.name} failed${e?.message ? `: ${e.message}` : ""}`);
    } finally {
      setPairingAddress(null);
    }
  };

  const handleUnpair = async (device: BtDevice) => {
    try {
      await SystemBridge.unpairBluetooth({ address: device.address });
      await loadBluetooth();
      onNetworkChange?.();
    } catch (e: any) {
      setBtError(e?.message || "Could not unpair device");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[oklch(14.5%_0_0)]/80 backdrop-blur-xl z-50 flex items-center justify-center"
        onClick={showAdminAuth ? undefined : onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[oklch(20.5%_0_0)] rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col border border-[oklch(26.9%_0_0)]"
        >
          {showAdminAuth ? (
            <div className="p-12 flex items-center justify-center flex-1">
              <AdminAuth
                onAuthenticated={() => { onEnterAdmin(); setShowAdminAuth(false); }}
                onCancel={() => setShowAdminAuth(false)}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-8 border-b border-[oklch(26.9%_0_0)]">
                <h2 className="text-3xl text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>Settings</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-[oklch(26.9%_0_0)] rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-[oklch(70.8%_0_0)]" />
                </button>
              </div>

              <div className="flex items-center gap-4 p-8 border-b border-[oklch(26.9%_0_0)]">
                <button
                  onClick={() => setActiveTab("wifi")}
                  className={`flex items-center gap-3 px-6 py-3 rounded-lg transition-colors ${
                    activeTab === "wifi"
                      ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]"
                      : "bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)]"
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  <Wifi className="w-5 h-5" />
                  Wi-Fi
                </button>
                <button
                  onClick={() => setActiveTab("bluetooth")}
                  className={`flex items-center gap-3 px-6 py-3 rounded-lg transition-colors ${
                    activeTab === "bluetooth"
                      ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]"
                      : "bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)]"
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  <Bluetooth className="w-5 h-5" />
                  Bluetooth
                </button>

                <div className="flex-1" />

                <button
                  onClick={() => (activeTab === "wifi" ? scanWifi() : scanBluetooth())}
                  disabled={wifiScanning || btScanning}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)] transition-colors disabled:opacity-50"
                  style={{ fontWeight: 500 }}
                >
                  {(activeTab === "wifi" ? wifiScanning : btScanning)
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <RefreshCw className="w-4 h-4" />}
                  {activeTab === "bluetooth" && !btScanning ? "Scan for devices" : "Refresh"}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {activeTab === "wifi" && (
                  <div className="space-y-3">
                    {wifiError && (
                      <div className="p-4 bg-[oklch(63.7%_0.237_25.331)]/10 border border-[oklch(63.7%_0.237_25.331)]/30 rounded-lg text-[oklch(70.4%_0.191_22.216)] text-sm">
                        {wifiError}
                      </div>
                    )}
                    {wifiScanning && networks.length === 0 && (
                      <div className="flex items-center justify-center gap-3 p-8 text-[oklch(55.6%_0_0)]">
                        <Loader2 className="w-5 h-5 animate-spin" /> Scanning for networks…
                      </div>
                    )}
                    {networks.map((network) => (
                      <div
                        key={network.ssid}
                        className="p-5 bg-[oklch(26.9%_0_0)] rounded-lg border border-[oklch(26.9%_0_0)] hover:border-[oklch(43.9%_0_0)] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Wifi className="w-5 h-5 text-[oklch(70.8%_0_0)]" />
                            <div>
                              <div className="text-[oklch(98.5%_0_0)] text-lg flex items-center gap-2" style={{ fontWeight: 400 }}>
                                {network.ssid}
                                {network.secured && <Lock className="w-3.5 h-3.5 text-[oklch(55.6%_0_0)]" />}
                              </div>
                              <div className="text-[oklch(55.6%_0_0)] text-sm" style={{ fontWeight: 400 }}>
                                {network.secured ? "Secured" : "Open"} • Signal: {network.signal}%
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            {network.connected ? (
                              <>
                                <span className="text-[oklch(48.8%_0.243_264.376)] text-sm px-4 py-2 bg-[oklch(48.8%_0.243_264.376)]/10 rounded-lg" style={{ fontWeight: 500 }}>
                                  Connected
                                </span>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleForgetWifi(network.ssid)}
                                    className="px-4 py-2 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors text-sm"
                                    style={{ fontWeight: 500 }}
                                  >
                                    Forget
                                  </button>
                                )}
                              </>
                            ) : connect.phase === "connecting" && connect.ssid === network.ssid ? (
                              <span className="flex items-center gap-2 text-[oklch(70.8%_0_0)] text-sm px-4 py-2" style={{ fontWeight: 500 }}>
                                <Loader2 className="w-4 h-4 animate-spin" /> Connecting…
                              </span>
                            ) : isAdmin ? (
                              <button
                                onClick={() => startConnect(network)}
                                className="px-4 py-2 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors text-sm"
                                style={{ fontWeight: 500 }}
                              >
                                Connect
                              </button>
                            ) : (
                              <span
                                className="flex items-center gap-1.5 text-[oklch(55.6%_0_0)] text-sm px-4 py-2"
                                style={{ fontWeight: 500 }}
                                title="Joining a network requires admin mode"
                              >
                                <Lock className="w-3.5 h-3.5" /> Admin only
                              </span>
                            )}
                          </div>
                        </div>

                        {connect.phase === "password" && connect.ssid === network.ssid && (
                          <form
                            className="mt-4 flex gap-3"
                            onSubmit={(e) => { e.preventDefault(); submitConnect(network.ssid, password); }}
                          >
                            <input
                              type="password"
                              autoFocus
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Network password"
                              className="flex-1 px-4 py-2.5 bg-[oklch(14.5%_0_0)] border border-[oklch(43.9%_0_0)] rounded-lg text-[oklch(98.5%_0_0)] placeholder:text-[oklch(43.9%_0_0)] outline-none focus:border-[oklch(48.8%_0.243_264.376)]"
                            />
                            <button
                              type="submit"
                              disabled={password.length < 8}
                              className="px-5 py-2.5 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg disabled:opacity-40 text-sm"
                              style={{ fontWeight: 500 }}
                            >
                              Join
                            </button>
                            <button
                              type="button"
                              onClick={() => setConnect({ phase: "idle" })}
                              className="px-5 py-2.5 bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] rounded-lg text-sm border border-[oklch(43.9%_0_0)]"
                              style={{ fontWeight: 500 }}
                            >
                              Cancel
                            </button>
                          </form>
                        )}

                        {(connect.phase === "pending-approval" || connect.phase === "failed") && connect.ssid === network.ssid && (
                          <div className="mt-4 p-4 bg-[oklch(14.5%_0_0)] rounded-lg text-sm text-[oklch(70.8%_0_0)] space-y-3">
                            <p>
                              {connect.phase === "failed"
                                ? (connect as any).message
                                : `Android hasn't joined this network yet. It may need approval in a system notification, or the password may be wrong.${isAdmin && isStandalone ? " You can also connect from system settings." : ""}`}
                            </p>
                            <div className="flex gap-3">
                              {isAdmin && isStandalone && (
                                <button
                                  onClick={() => SystemBridge.openWifiSettings()}
                                  className="flex items-center gap-2 px-4 py-2 bg-[oklch(26.9%_0_0)] rounded-lg text-[oklch(87%_0_0)]"
                                  style={{ fontWeight: 500 }}
                                >
                                  <ExternalLink className="w-4 h-4" /> Open Wi-Fi settings
                                </button>
                              )}
                              <button
                                onClick={() => setConnect({ phase: "idle" })}
                                className="px-4 py-2 bg-[oklch(26.9%_0_0)] rounded-lg"
                                style={{ fontWeight: 500 }}
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {!wifiScanning && networks.length === 0 && !wifiError && (
                      <div className="text-center p-8 text-[oklch(55.6%_0_0)]">No networks found</div>
                    )}
                  </div>
                )}

                {activeTab === "bluetooth" && (
                  <div className="space-y-3">
                    {/* Bluetooth on/off toggle */}
                    <div className="flex items-center justify-between p-5 bg-[oklch(26.9%_0_0)] rounded-lg border border-[oklch(26.9%_0_0)]">
                      <div className="flex items-center gap-4">
                        <Bluetooth className={`w-5 h-5 ${btEnabled ? "text-[oklch(48.8%_0.243_264.376)]" : "text-[oklch(55.6%_0_0)]"}`} />
                        <div>
                          <div className="text-[oklch(98.5%_0_0)] text-lg" style={{ fontWeight: 400 }}>Bluetooth</div>
                          <div className="text-[oklch(55.6%_0_0)] text-sm" style={{ fontWeight: 400 }}>
                            {btToggling
                              ? "Waiting for confirmation…"
                              : `${btEnabled ? "On" : "Off"}${!isAdmin ? " • Admin only" : ""}`}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => isAdmin && btEnabled !== null && toggleBluetooth(!btEnabled)}
                        disabled={!isAdmin || btToggling || btEnabled === null}
                        className={`relative w-14 h-8 rounded-full transition-colors disabled:opacity-50 ${
                          btEnabled ? "bg-[oklch(48.8%_0.243_264.376)]" : "bg-[oklch(43.9%_0_0)]"
                        }`}
                        aria-label={btEnabled ? "Turn Bluetooth off" : "Turn Bluetooth on"}
                        title={!isAdmin ? "Changing Bluetooth requires admin mode" : undefined}
                      >
                        <span
                          className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${
                            btEnabled ? "left-7" : "left-1"
                          }`}
                        />
                      </button>
                    </div>

                    {btError && (
                      <div className="p-4 bg-[oklch(63.7%_0.237_25.331)]/10 border border-[oklch(63.7%_0.237_25.331)]/30 rounded-lg text-[oklch(70.4%_0.191_22.216)] text-sm">
                        {btError}
                      </div>
                    )}
                    {btScanning && (
                      <div className="flex items-center justify-center gap-3 p-4 text-[oklch(55.6%_0_0)]">
                        <Loader2 className="w-5 h-5 animate-spin" /> Scanning for nearby devices (~12s)…
                      </div>
                    )}
                    {btDevices.map((device) => (
                      <div
                        key={device.address}
                        className="flex items-center justify-between p-5 bg-[oklch(26.9%_0_0)] rounded-lg border border-[oklch(26.9%_0_0)] hover:border-[oklch(43.9%_0_0)] transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <Bluetooth className="w-5 h-5 text-[oklch(70.8%_0_0)]" />
                          <div>
                            <div className="text-[oklch(98.5%_0_0)] text-lg" style={{ fontWeight: 400 }}>{device.name}</div>
                            <div className="text-[oklch(55.6%_0_0)] text-sm" style={{ fontWeight: 400 }}>
                              {device.connected ? "Connected" : device.paired ? "Paired" : "Available"}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          {device.connected ? (
                            <>
                              <span className="text-[oklch(48.8%_0.243_264.376)] text-sm px-4 py-2 bg-[oklch(48.8%_0.243_264.376)]/10 rounded-lg" style={{ fontWeight: 500 }}>
                                Connected
                              </span>
                              {isAdmin && (
                                <button
                                  onClick={() => handleUnpair(device)}
                                  className="px-4 py-2 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors text-sm"
                                  style={{ fontWeight: 500 }}
                                >
                                  Forget
                                </button>
                              )}
                            </>
                          ) : pairingAddress === device.address ? (
                            <span className="flex items-center gap-2 text-[oklch(70.8%_0_0)] text-sm px-4 py-2" style={{ fontWeight: 500 }}>
                              <Loader2 className="w-4 h-4 animate-spin" /> Pairing…
                            </span>
                          ) : device.paired ? (
                            <>
                              {isAdmin && isStandalone ? (
                                <button
                                  onClick={() => SystemBridge.openBluetoothSettings()}
                                  className="px-4 py-2 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors text-sm"
                                  style={{ fontWeight: 500 }}
                                  title="Paired devices reconnect automatically when turned on; open settings to connect manually"
                                >
                                  Connect
                                </button>
                              ) : (
                                <span
                                  className="text-[oklch(55.6%_0_0)] text-sm px-4 py-2"
                                  style={{ fontWeight: 500 }}
                                  title="Paired devices reconnect automatically when powered on"
                                >
                                  Paired
                                </span>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => handleUnpair(device)}
                                  className="px-4 py-2 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors text-sm"
                                  style={{ fontWeight: 500 }}
                                >
                                  Forget
                                </button>
                              )}
                            </>
                          ) : isAdmin ? (
                            <button
                              onClick={() => handlePair(device)}
                              className="px-4 py-2 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors text-sm"
                              style={{ fontWeight: 500 }}
                            >
                              Pair
                            </button>
                          ) : (
                            <span
                              className="flex items-center gap-1.5 text-[oklch(55.6%_0_0)] text-sm px-4 py-2"
                              style={{ fontWeight: 500 }}
                              title="Pairing requires admin mode"
                            >
                              <Lock className="w-3.5 h-3.5" /> Admin only
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {!btScanning && btDevices.length === 0 && !btError && (
                      <div className="text-center p-8 text-[oklch(55.6%_0_0)]">
                        {btEnabled
                          ? 'No devices yet — tap "Scan for devices" to discover nearby Bluetooth devices in pairing mode'
                          : "Turn on Bluetooth to pair controllers, headsets and other devices"}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-[oklch(26.9%_0_0)] p-8 flex gap-4 items-center">
                {isAdmin ? (
                  <>
                    <button
                      onClick={onOpenAdminPanel}
                      className="flex items-center gap-3 px-6 py-4 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <LayoutGrid className="w-5 h-5" />
                      Admin Panel
                    </button>
                    <button
                      onClick={onExitAdmin}
                      className="flex items-center gap-3 px-6 py-4 bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] rounded-lg hover:bg-[oklch(43.9%_0_0)] transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <Shield className="w-5 h-5" />
                      Exit Admin
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowAdminAuth(true)}
                    className="flex items-center gap-3 px-6 py-4 bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] rounded-lg hover:bg-[oklch(43.9%_0_0)] transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Shield className="w-5 h-5" />
                    Admin Mode
                  </button>
                )}

                {/* Standalone-only: exiting the kiosk requires admin auth first. */}
                {isStandalone && isAdmin && (
                  <button
                    onClick={onExitKiosk}
                    className="flex items-center gap-3 px-6 py-4 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <LogOut className="w-5 h-5" />
                    Exit Kiosk
                  </button>
                )}

                <div className="flex-1" />

                {/* System settings is an escape vector. On ArborXR-managed
                    (companion) devices the Device Owner blocks launching Android
                    Settings, so this silently does nothing — only show it in
                    standalone mode, where OpenPanel manages the device. */}
                {isAdmin && isStandalone && (
                  <button
                    onClick={() => (activeTab === "wifi" ? SystemBridge.openWifiSettings() : SystemBridge.openBluetoothSettings())}
                    className="flex items-center gap-2 px-5 py-4 text-[oklch(55.6%_0_0)] hover:text-[oklch(87%_0_0)] transition-colors text-sm"
                    style={{ fontWeight: 500 }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    System settings
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
