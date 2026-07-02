import { motion } from "motion/react";
import { X, Plus, Trash2, Clock, Power, Youtube, Lock, Unlock, ShieldCheck, Smartphone, Monitor, Check, AlertTriangle } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { useState } from "react";
import { type KioskVideo, thumbnailUrl } from "../native/youtube";
import type { KioskStatus } from "../native/SystemBridge";
import type { AppMode } from "../appConfig";

interface App {
  id: string;
  name: string;
  icon: LucideIcon;
  gradient: string;
}

interface AppTimeLimit {
  appId: string;
  limitMinutes: number;
}

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  apps: App[];
  availableApps: App[];
  onAddApp: (appId: string) => void;
  onRemoveApp: (appId: string) => void;
  appTimeLimits: AppTimeLimit[];
  onSetTimeLimit: (appId: string, minutes: number) => void;
  inactivityTimeout: number;
  onSetInactivityTimeout: (minutes: number) => void;
  // Locked YouTube links
  videos: KioskVideo[];
  onAddVideo: (url: string, title: string) => boolean; // false if URL invalid
  onRemoveVideo: (videoId: string) => void;
  // Standalone (non-ArborXR) kiosk lockdown
  standalone: boolean;
  appMode: AppMode;
  onSetAppMode: (mode: AppMode) => void;
  kioskStatus: KioskStatus | null;
  onRefreshKiosk: () => void;
  onSetDefaultLauncher: () => void;
  onRequestDeviceAdmin: () => void;
  onLockKiosk: () => void;
  onUnlockKiosk: () => void;
}

export function AdminPanel({
  isOpen,
  onClose,
  apps,
  availableApps,
  onAddApp,
  onRemoveApp,
  appTimeLimits,
  onSetTimeLimit,
  inactivityTimeout,
  onSetInactivityTimeout,
  videos,
  onAddVideo,
  onRemoveVideo,
  standalone,
  appMode,
  onSetAppMode,
  kioskStatus,
  onRefreshKiosk,
  onSetDefaultLauncher,
  onRequestDeviceAdmin,
  onLockKiosk,
  onUnlockKiosk,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"apps" | "youtube" | "kiosk" | "limits" | "power">("apps");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);

  const getTimeLimit = (appId: string) => {
    return appTimeLimits.find(t => t.appId === appId)?.limitMinutes || 0;
  };

  const handleAddVideo = () => {
    if (!onAddVideo(videoUrl, videoTitle)) {
      setVideoError("That doesn't look like a YouTube link.");
      return;
    }
    setVideoUrl("");
    setVideoTitle("");
    setVideoError(null);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[oklch(14.5%_0_0)]/80 backdrop-blur-xl z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[oklch(20.5%_0_0)] rounded-2xl w-full max-w-5xl max-h-[80vh] overflow-hidden flex flex-col border border-[oklch(26.9%_0_0)]"
      >
        <div className="flex items-center justify-between p-8 border-b border-[oklch(26.9%_0_0)]">
          <h2 className="text-3xl text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>Admin Panel</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[oklch(26.9%_0_0)] rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-[oklch(70.8%_0_0)]" />
          </button>
        </div>

        <div className="flex gap-2 px-8 pt-6 pb-4 border-b border-[oklch(26.9%_0_0)]">
          <button
            onClick={() => setActiveTab("apps")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === "apps"
                ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]"
                : "bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)]"
            }`}
            style={{ fontWeight: 500 }}
          >
            Applications
          </button>
          <button
            onClick={() => setActiveTab("youtube")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === "youtube"
                ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]"
                : "bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)]"
            }`}
            style={{ fontWeight: 500 }}
          >
            <Youtube className="w-4 h-4" />
            YouTube
          </button>
          <button
            onClick={() => setActiveTab("limits")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === "limits"
                ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]"
                : "bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)]"
            }`}
            style={{ fontWeight: 500 }}
          >
            <Clock className="w-4 h-4" />
            Time Limits
          </button>
          <button
            onClick={() => setActiveTab("power")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === "power"
                ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]"
                : "bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)]"
            }`}
            style={{ fontWeight: 500 }}
          >
            <Power className="w-4 h-4" />
            Power Settings
          </button>
          {standalone && (
            <button
              onClick={() => setActiveTab("kiosk")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === "kiosk"
                  ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]"
                  : "bg-[oklch(26.9%_0_0)] text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)]"
              }`}
              style={{ fontWeight: 500 }}
            >
              <Lock className="w-4 h-4" />
              Kiosk Lock
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === "apps" && (
            <>
              <div className="mb-12">
                <h3 className="text-xl text-[oklch(98.5%_0_0)] mb-6" style={{ fontWeight: 500 }}>Allowed Applications</h3>
                <div className="grid grid-cols-4 gap-4">
                  {apps.map((app) => (
                    <div
                      key={app.id}
                      className="relative group bg-[oklch(26.9%_0_0)] rounded-lg p-6 hover:bg-[oklch(43.9%_0_0)]/30 transition-colors border border-[oklch(26.9%_0_0)] hover:border-[oklch(43.9%_0_0)]"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <app.icon className="w-12 h-12 text-[oklch(70.8%_0_0)]" />
                        <span className="text-[oklch(87%_0_0)] text-sm text-center" style={{ fontWeight: 400 }}>{app.name}</span>
                      </div>
                      <button
                        onClick={() => onRemoveApp(app.id)}
                        className="absolute top-2 right-2 p-2 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[oklch(63.7%_0.237_25.331)]/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xl text-[oklch(98.5%_0_0)] mb-6" style={{ fontWeight: 500 }}>Available Applications</h3>
                <div className="grid grid-cols-4 gap-4">
                  {availableApps
                    .filter((app) => !apps.find((a) => a.id === app.id))
                    .map((app) => (
                      <div
                        key={app.id}
                        className="relative group bg-[oklch(26.9%_0_0)]/50 rounded-lg p-6 hover:bg-[oklch(43.9%_0_0)]/30 transition-colors border-2 border-dashed border-[oklch(43.9%_0_0)]"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <app.icon className="w-12 h-12 text-[oklch(55.6%_0_0)]" />
                          <span className="text-[oklch(70.8%_0_0)] text-sm text-center" style={{ fontWeight: 400 }}>{app.name}</span>
                        </div>
                        <button
                          onClick={() => onAddApp(app.id)}
                          className="absolute top-2 right-2 p-2 bg-[oklch(48.8%_0.243_264.376)]/20 text-[oklch(48.8%_0.243_264.376)] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[oklch(48.8%_0.243_264.376)]/30"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "youtube" && (
            <div>
              <h3 className="text-xl text-[oklch(98.5%_0_0)] mb-2" style={{ fontWeight: 500 }}>Locked YouTube Videos</h3>
              <p className="text-[oklch(70.8%_0_0)] text-sm mb-6" style={{ fontWeight: 400 }}>
                Added videos appear as tiles on the home screen and play in a locked player — playback controls only, no recommendations or way out to YouTube.
              </p>

              <div className="bg-[oklch(26.9%_0_0)] rounded-lg p-5 mb-8">
                <label className="block text-[oklch(70.8%_0_0)] text-sm mb-2" style={{ fontWeight: 500 }}>YouTube link</label>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => { setVideoUrl(e.target.value); setVideoError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddVideo(); }}
                  placeholder="https://www.youtube.com/watch?v=…  or  https://youtu.be/…"
                  className="w-full mb-4 px-4 py-2.5 bg-[oklch(20.5%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none placeholder:text-[oklch(43.9%_0_0)]"
                  style={{ fontWeight: 400 }}
                />
                <label className="block text-[oklch(70.8%_0_0)] text-sm mb-2" style={{ fontWeight: 500 }}>Title (optional)</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddVideo(); }}
                    placeholder="Shown on the tile"
                    className="flex-1 px-4 py-2.5 bg-[oklch(20.5%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none placeholder:text-[oklch(43.9%_0_0)]"
                    style={{ fontWeight: 400 }}
                  />
                  <button
                    onClick={handleAddVideo}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
                {videoError && <p className="mt-3 text-[oklch(70.4%_0.191_22.216)] text-sm">{videoError}</p>}
              </div>

              {videos.length === 0 ? (
                <div className="text-center p-8 text-[oklch(55.6%_0_0)]">No locked videos yet. Paste a YouTube link above.</div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {videos.map((v) => (
                    <div
                      key={v.videoId}
                      className="relative group flex items-center gap-4 bg-[oklch(26.9%_0_0)] rounded-lg p-3 border border-[oklch(26.9%_0_0)] hover:border-[oklch(43.9%_0_0)] transition-colors"
                    >
                      <img
                        src={thumbnailUrl(v.videoId)}
                        alt=""
                        className="w-28 h-16 rounded object-cover bg-[oklch(20.5%_0_0)] shrink-0"
                        draggable={false}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[oklch(98.5%_0_0)] text-sm truncate" style={{ fontWeight: 500 }}>{v.title}</div>
                        <div className="text-[oklch(55.6%_0_0)] text-xs truncate" style={{ fontWeight: 400 }}>{v.videoId}</div>
                      </div>
                      <button
                        onClick={() => onRemoveVideo(v.videoId)}
                        className="shrink-0 p-2 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors"
                        aria-label={`Remove ${v.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "limits" && (
            <div>
              <h3 className="text-xl text-[oklch(98.5%_0_0)] mb-6" style={{ fontWeight: 500 }}>App Time Limits</h3>
              <div className="space-y-3">
                {apps.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-5 bg-[oklch(26.9%_0_0)] rounded-lg hover:bg-[oklch(43.9%_0_0)]/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <app.icon className="w-8 h-8 text-[oklch(70.8%_0_0)]" />
                      <span className="text-[oklch(98.5%_0_0)]" style={{ fontWeight: 400 }}>{app.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        placeholder="No limit"
                        value={getTimeLimit(app.id) || ""}
                        onChange={(e) => onSetTimeLimit(app.id, Number(e.target.value))}
                        className="w-24 px-3 py-2 bg-[oklch(20.5%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none text-center"
                        style={{ fontWeight: 400 }}
                      />
                      <span className="text-[oklch(70.8%_0_0)] text-sm" style={{ fontWeight: 400 }}>minutes/day</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "power" && (
            <div>
              <h3 className="text-xl text-[oklch(98.5%_0_0)] mb-6" style={{ fontWeight: 500 }}>Power Management</h3>
              <div className="bg-[oklch(26.9%_0_0)] rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[oklch(98.5%_0_0)] mb-2" style={{ fontWeight: 500 }}>Inactivity Timeout</div>
                    <div className="text-[oklch(70.8%_0_0)] text-sm" style={{ fontWeight: 400 }}>
                      Auto-shutdown when screen is not touched (and no video is playing)
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={inactivityTimeout}
                      onChange={(e) => onSetInactivityTimeout(Number(e.target.value))}
                      className="w-24 px-3 py-2 bg-[oklch(20.5%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none text-center"
                      style={{ fontWeight: 400 }}
                    />
                    <span className="text-[oklch(70.8%_0_0)]" style={{ fontWeight: 400 }}>minutes</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "kiosk" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>Kiosk Lock</h3>
                <button onClick={onRefreshKiosk} className="text-[oklch(70.8%_0_0)] hover:text-[oklch(87%_0_0)] text-sm" style={{ fontWeight: 500 }}>Refresh status</button>
              </div>
              <p className="text-[oklch(70.8%_0_0)] text-sm mb-6" style={{ fontWeight: 400 }}>
                For devices not managed by ArborXR. Make OpenPanel the home launcher and a device admin, then lock the device into the kiosk.
              </p>

              {/* Management mode */}
              <div className="bg-[oklch(26.9%_0_0)] rounded-lg p-5 mb-6">
                <div className="text-[oklch(98.5%_0_0)] mb-1" style={{ fontWeight: 500 }}>Management mode</div>
                <div className="text-[oklch(70.8%_0_0)] text-sm mb-4" style={{ fontWeight: 400 }}>
                  Standalone = OpenPanel locks the device itself. Companion = ArborXR manages lockdown.
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => onSetAppMode("standalone")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${appMode === "standalone" ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]" : "bg-[oklch(20.5%_0_0)] text-[oklch(70.8%_0_0)] border border-[oklch(43.9%_0_0)] hover:text-[oklch(87%_0_0)]"}`}
                    style={{ fontWeight: 500 }}
                  >
                    <Smartphone className="w-4 h-4" /> Standalone
                  </button>
                  <button
                    onClick={() => onSetAppMode("companion")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${appMode === "companion" ? "bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)]" : "bg-[oklch(20.5%_0_0)] text-[oklch(70.8%_0_0)] border border-[oklch(43.9%_0_0)] hover:text-[oklch(87%_0_0)]"}`}
                    style={{ fontWeight: 500 }}
                  >
                    <Monitor className="w-4 h-4" /> Companion (ArborXR)
                  </button>
                </div>
              </div>

              {/* Setup steps */}
              <div className="space-y-3 mb-6">
                {[
                  { label: "Set OpenPanel as Home launcher", ok: !!kioskStatus?.defaultLauncher, action: onSetDefaultLauncher, actionLabel: "Choose", hint: undefined as string | undefined },
                  { label: "Enable OpenPanel device admin", ok: !!kioskStatus?.deviceAdmin, action: onRequestDeviceAdmin, actionLabel: "Enable", hint: undefined as string | undefined },
                  { label: "Device Owner (silent full lockdown)", ok: !!kioskStatus?.deviceOwner, action: undefined, actionLabel: undefined, hint: "Provisioned via ADB/QR before setup — can't be enabled from inside the app" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between p-4 bg-[oklch(26.9%_0_0)] rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      {row.ok
                        ? <Check className="w-5 h-5 text-[oklch(72%_0.19_142)] shrink-0" />
                        : <AlertTriangle className="w-5 h-5 text-[oklch(70.4%_0.191_22.216)] shrink-0" />}
                      <div className="min-w-0">
                        <div className="text-[oklch(98.5%_0_0)] text-sm" style={{ fontWeight: 500 }}>{row.label}</div>
                        {row.hint && <div className="text-[oklch(55.6%_0_0)] text-xs" style={{ fontWeight: 400 }}>{row.hint}</div>}
                      </div>
                    </div>
                    {row.action && !row.ok && (
                      <button
                        onClick={row.action}
                        className="shrink-0 px-4 py-2 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors text-sm"
                        style={{ fontWeight: 500 }}
                      >
                        {row.actionLabel}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Lock / unlock */}
              {kioskStatus?.lockTaskActive ? (
                <button
                  onClick={onUnlockKiosk}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  <Unlock className="w-5 h-5" /> Unlock kiosk ({kioskStatus.lockTaskMode})
                </button>
              ) : (
                <button
                  onClick={onLockKiosk}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  <Lock className="w-5 h-5" /> Lock device into kiosk
                </button>
              )}

              {kioskStatus && !kioskStatus.deviceOwner && (
                <div className="mt-4 flex items-start gap-3 p-4 bg-[oklch(70.4%_0.191_22.216)]/10 border border-[oklch(70.4%_0.191_22.216)]/30 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-[oklch(70.4%_0.191_22.216)] shrink-0 mt-0.5" />
                  <p className="text-[oklch(87%_0_0)] text-sm" style={{ fontWeight: 400 }}>
                    Without Device Owner, OpenPanel uses Android screen pinning. It's a real lock but can be exited by holding Back + Overview. For tamper-resistant lockdown, provision OpenPanel as Device Owner via ADB/QR before handing over the device.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
