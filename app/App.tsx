import { useState, useEffect, useCallback, useRef } from "react";
import { Gamepad2 } from "lucide-react";
import { StatusBar } from "./components/StatusBar";
import { SettingsModal } from "./components/SettingsModal";
import { AdminPanel } from "./components/AdminPanel";
import { FeaturedHero } from "./components/FeaturedHero";
import { ContentRow } from "./components/ContentRow";
import { YouTubePlayer } from "./components/YouTubePlayer";
import { ModeSetup } from "./components/ModeSetup";
import { getVideos, addVideo, removeVideo, thumbnailUrl, type KioskVideo } from "./native/youtube";
import { getAppMode, setAppMode as persistAppMode, isAppModeConfigured, type AppMode } from "./appConfig";
import { SystemBridge, type InstalledApp, type KioskStatus } from "./native/SystemBridge";

export interface ContentItem {
  id: string;
  title: string;
  imageUrl?: string;
  iconUrl?: string;
  coverUrl: string;
  description?: string;
  genre?: string;
  category: string;
  packageName?: string;
  isVideo?: boolean;
  videoId?: string; // YouTube id when isVideo
  duration?: string;
  year?: number;
  rating?: string;
  matchPct?: number;
  badge?: "new" | "top10" | "trending";
  tileType?: "portrait" | "landscape";
}

// Apps deployed by ArborXR carry this installer attribution on-device.
const ARBORXR_INSTALLER = "app.xrdm.client";
// Managed by ArborXR but installed before enrollment, so installer is null.
const EXTRA_ALLOWED = new Set(["com.mojang.minecraftpe"]);
// ArborXR-installed utility packages that are not user-facing content.
const EXCLUDED = new Set(["app.xrdm.client", "app.revanced.android.gms"]);

const GRADIENTS = [
  "#dc2626, #450a0a",
  "#1d4ed8, #172554",
  "#7c3aed, #3b0764",
  "#0891b2, #164e63",
  "#d97706, #78350f",
  "#059669, #064e3b",
  "#ea580c, #7c2d12",
  "#db2777, #831843",
];

function gradientFor(packageName: string): string {
  let hash = 0;
  for (let i = 0; i < packageName.length; i++) {
    hash = (hash * 31 + packageName.charCodeAt(i)) | 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function isAllowed(app: InstalledApp): boolean {
  if (EXCLUDED.has(app.packageName)) return false;
  if (app.isSystem) return false;
  return app.installer === ARBORXR_INSTALLER || EXTRA_ALLOWED.has(app.packageName);
}

function toContentItem(app: InstalledApp): ContentItem {
  return {
    id: app.packageName,
    title: app.label,
    packageName: app.packageName,
    iconUrl: app.icon ? `data:image/png;base64,${app.icon}` : undefined,
    coverUrl: gradientFor(app.packageName),
    description: `Opens ${app.label} on this device.`,
    genre: "App",
    category: "apps",
    tileType: "landscape",
  };
}

function toVideoItem(v: KioskVideo): ContentItem {
  return {
    id: `yt:${v.videoId}`,
    title: v.title,
    videoId: v.videoId,
    isVideo: true,
    imageUrl: thumbnailUrl(v.videoId),
    coverUrl: gradientFor(v.videoId),
    description: `Play ${v.title}`,
    genre: "YouTube",
    category: "video",
    tileType: "landscape",
  };
}

export default function App() {
  const [apps, setApps] = useState<ContentItem[]>([]);
  const [hiddenApps, setHiddenApps] = useState<Set<string>>(new Set());
  const [featuredItem, setFeaturedItem] = useState<ContentItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"wifi" | "bluetooth">("wifi");
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [battery, setBattery] = useState({ level: -1, isCharging: false });
  const [wifi, setWifi] = useState({ connected: false, ssid: undefined as string | undefined });
  const [btConnected, setBtConnected] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [inactivityTimeout, setInactivityTimeout] = useState(8);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const launchingRef = useRef(false);

  const [appMode, setAppMode] = useState<AppMode>(getAppMode());
  // Decided after first-run detection (see effect below); a stored choice wins.
  const [needsModeSetup, setNeedsModeSetup] = useState(false);
  const [videos, setVideos] = useState<KioskVideo[]>(getVideos());
  const [playingVideo, setPlayingVideo] = useState<KioskVideo | null>(null);
  const [kioskStatus, setKioskStatus] = useState<KioskStatus | null>(null);
  const isStandalone = appMode === "standalone";

  const chooseAppMode = useCallback((mode: AppMode) => {
    persistAppMode(mode);
    setAppMode(mode);
    setNeedsModeSetup(false);
  }, []);

  const refreshKiosk = useCallback(async () => {
    try { setKioskStatus(await SystemBridge.getKioskStatus()); } catch (e) { console.error("Failed to read kiosk status", e); }
  }, []);

  const videoItems = videos.map(toVideoItem);

  const loadApps = useCallback(async () => {
    try {
      const { apps: installed } = await SystemBridge.getInstalledApps();
      const allowed = installed.filter(isAllowed).map(toContentItem);
      allowed.sort((a, b) => a.title.localeCompare(b.title));
      setApps(allowed);
      // Keep the current selection across refreshes (videos aren't in the
      // installed-apps list, so they'd otherwise be deselected every poll).
      setFeaturedItem(prev => prev && (prev.isVideo || allowed.some(a => a.id === prev.id)) ? prev : allowed[0] ?? null);
    } catch (e) {
      console.error("Failed to load apps", e);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const [bat, wf, bt] = await Promise.all([
        SystemBridge.getBatteryInfo(),
        SystemBridge.getWifiStatus(),
        SystemBridge.getBluetoothStatus(),
      ]);
      setBattery(bat);
      setWifi({ connected: wf.connected, ssid: wf.ssid });
      setBtConnected(!!bt.enabled && !!bt.devices?.some(d => d.connected));
    } catch (e) {
      console.error("Failed to refresh status", e);
    }
  }, []);

  useEffect(() => {
    loadApps();
    refreshStatus();
    const statusTimer = setInterval(refreshStatus, 15000);
    const appsTimer = setInterval(loadApps, 60000);

    const onResume = () => {
      if (document.visibilityState === "visible") {
        loadApps();
        refreshStatus();
      }
    };
    document.addEventListener("visibilitychange", onResume);
    return () => {
      clearInterval(statusTimer);
      clearInterval(appsTimer);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, [loadApps, refreshStatus]);

  const handleLaunch = async (item: ContentItem) => {
    // Locked YouTube videos open the in-app player instead of launching a package.
    if (item.isVideo && item.videoId) {
      setPlayingVideo({ videoId: item.videoId, title: item.title, addedAt: 0 });
      return;
    }
    if (!item.packageName || launchingRef.current) return;
    launchingRef.current = true;
    try {
      await SystemBridge.launchApp({ packageName: item.packageName });
    } catch (e) {
      console.error("Failed to launch", item.packageName, e);
    } finally {
      setTimeout(() => { launchingRef.current = false; }, 1500);
    }
  };

  useEffect(() => {
    if (isStandalone) refreshKiosk();
  }, [isStandalone, refreshKiosk]);

  // First run only: auto-detect ArborXR (it's the Device Owner) and pick
  // companion silently — no prompt. If the device isn't ArborXR-managed, show
  // the setup prompt. Once a choice is stored, it always wins (admin can change
  // it later in the Kiosk tab).
  useEffect(() => {
    if (isAppModeConfigured()) return;
    let cancelled = false;
    (async () => {
      try {
        const k = await SystemBridge.getKioskStatus();
        if (cancelled) return;
        if (k.arborXrManaged) { chooseAppMode("companion"); return; }
      } catch (e) {
        console.error("Management detection failed", e);
      }
      if (!cancelled) setNeedsModeSetup(true);
    })();
    return () => { cancelled = true; };
  }, [chooseAppMode]);

  useEffect(() => {
    const handleActivity = () => {
      setLastActivity(Date.now());
      if (isSleeping) setIsSleeping(false);
    };
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    const check = setInterval(() => {
      const inactive = (Date.now() - lastActivity) / 1000 / 60;
      if (inactive >= inactivityTimeout && !isSleeping) setIsSleeping(true);
    }, 30000);
    return () => {
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      clearInterval(check);
    };
  }, [lastActivity, inactivityTimeout, isSleeping]);

  const visibleApps = apps.filter(a => !hiddenApps.has(a.id));
  const featured = featuredItem && !hiddenApps.has(featuredItem.id) ? featuredItem : visibleApps[0] ?? null;

  return (
    <div className="size-full bg-[oklch(11%_0_0)] overflow-y-auto overflow-x-hidden relative">
      {/* Sleep Screen */}
      {isSleeping && (
        <div
          className="fixed inset-0 bg-black z-[200] flex items-center justify-center cursor-pointer"
          onClick={() => setIsSleeping(false)}
        >
          <div className="text-center select-none">
            <div className="text-[oklch(70%_0_0)] text-5xl mb-3 tracking-tight" style={{ fontWeight: 300 }}>
              {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
            </div>
            <div className="text-[oklch(38%_0_0)] text-sm tracking-widest uppercase">
              Tap anywhere to wake
            </div>
          </div>
        </div>
      )}

      <StatusBar
        onSettingsClick={() => { setSettingsTab("wifi"); setIsSettingsOpen(true); }}
        onWifiClick={() => { setSettingsTab("wifi"); setIsSettingsOpen(true); }}
        onBluetoothClick={() => { setSettingsTab("bluetooth"); setIsSettingsOpen(true); }}
        isWifiConnected={wifi.connected}
        wifiSsid={wifi.ssid}
        isBluetoothConnected={btConnected}
        batteryLevel={battery.level}
        isCharging={battery.isCharging}
      />

      <div className="pt-16">
        {featured ? (
          <FeaturedHero
            item={featured}
            onLaunch={() => handleLaunch(featured)}
          />
        ) : (
          <div className="h-[520px] flex items-center justify-center">
            <div className="text-center">
              <Gamepad2 className="w-12 h-12 text-[oklch(30%_0_0)] mx-auto mb-4" />
              <p className="text-[oklch(50%_0_0)] text-lg">No apps assigned to this device yet</p>
              <p className="text-[oklch(38%_0_0)] text-sm mt-1">Deploy apps from ArborXR to see them here</p>
            </div>
          </div>
        )}

        <div className="pb-16 space-y-2">
          {visibleApps.length > 0 && (
            <ContentRow
              title="Apps & Games"
              items={visibleApps}
              selectedId={featured?.id ?? null}
              onSelect={setFeaturedItem}
              onLaunch={handleLaunch}
            />
          )}
          {videoItems.length > 0 && (
            <ContentRow
              title="Videos"
              items={videoItems}
              selectedId={featured?.id ?? null}
              onSelect={setFeaturedItem}
              onLaunch={handleLaunch}
            />
          )}
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => { setIsSettingsOpen(false); setIsAdmin(false); setIsAdminPanelOpen(false); refreshStatus(); }}
        isStandalone={isStandalone}
        onExitKiosk={async () => { try { await SystemBridge.disableKioskLock(); } catch (e) { console.error("exit kiosk", e); } refreshKiosk(); }}
        isAdmin={isAdmin}
        onEnterAdmin={() => setIsAdmin(true)}
        onExitAdmin={() => { setIsAdmin(false); setIsAdminPanelOpen(false); }}
        onOpenAdminPanel={() => { setIsAdminPanelOpen(true); if (isStandalone) refreshKiosk(); }}
        initialTab={settingsTab}
        onNetworkChange={refreshStatus}
      />

      <AdminPanel
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        apps={visibleApps.map(g => ({
          id: g.id, name: g.title, icon: Gamepad2,
          gradient: `bg-gradient-to-br from-[${g.coverUrl.split(", ")[0]}] to-[${g.coverUrl.split(", ")[1]}]`
        }))}
        availableApps={apps.map(g => ({
          id: g.id, name: g.title, icon: Gamepad2,
          gradient: `bg-gradient-to-br from-[${g.coverUrl.split(", ")[0]}] to-[${g.coverUrl.split(", ")[1]}]`
        }))}
        onAddApp={(id) => setHiddenApps(prev => { const next = new Set(prev); next.delete(id); return next; })}
        onRemoveApp={(id) => setHiddenApps(prev => new Set(prev).add(id))}
        appTimeLimits={[]}
        onSetTimeLimit={() => {}}
        inactivityTimeout={inactivityTimeout}
        onSetInactivityTimeout={setInactivityTimeout}
        videos={videos}
        onAddVideo={(url, title) => { const v = addVideo(url, title); if (!v) return false; setVideos(getVideos()); return true; }}
        onRemoveVideo={(id) => { removeVideo(id); setVideos(getVideos()); }}
        standalone={isStandalone}
        appMode={appMode}
        onSetAppMode={chooseAppMode}
        kioskStatus={kioskStatus}
        onRefreshKiosk={refreshKiosk}
        onSetDefaultLauncher={() => SystemBridge.openLauncherSettings()}
        onRequestDeviceAdmin={async () => { try { await SystemBridge.requestDeviceAdmin(); } catch (e) { console.error("device admin", e); } setTimeout(refreshKiosk, 500); }}
        onLockKiosk={async () => {
          const packages = apps.map(a => a.packageName).filter((p): p is string => !!p);
          try { await SystemBridge.enableKioskLock({ packages }); } catch (e) { console.error("lock kiosk", e); }
          refreshKiosk();
        }}
        onUnlockKiosk={async () => { try { await SystemBridge.disableKioskLock(); } catch (e) { console.error("unlock kiosk", e); } refreshKiosk(); }}
      />

      {playingVideo && (
        <YouTubePlayer
          videoId={playingVideo.videoId}
          title={playingVideo.title}
          onClose={() => setPlayingVideo(null)}
        />
      )}

      {needsModeSetup && <ModeSetup onChoose={chooseAppMode} />}

      <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
