import { useState, useEffect, useCallback, useRef } from "react";
import { type PluginListenerHandle } from "@capacitor/core";
import { Gamepad2 } from "lucide-react";
import { StatusBar } from "./components/StatusBar";
import { SettingsModal } from "./components/SettingsModal";
import { AdminPanel } from "./components/AdminPanel";
import { FeaturedHero } from "./components/FeaturedHero";
import { ContentRow } from "./components/ContentRow";
import { YouTubePlayer } from "./components/YouTubePlayer";
import { YouTubeChannelBrowser } from "./components/YouTubeChannelBrowser";
import { ModeSetup } from "./components/ModeSetup";
import { StandaloneOnboarding } from "./components/StandaloneOnboarding";
import {
  addYouTubeItem,
  channelIdForYouTubeItem,
  channelMetadataNeedsRefresh,
  displayTitleForYouTubeItem,
  getYouTubeItems,
  initializeApprovedYouTubeItems,
  removeYouTubeItem,
  thumbnailUrl,
  type KioskYouTubeItem,
} from "./native/youtube";
import {
  getAppMode,
  setAppMode as persistAppMode,
  isAppModeConfigured,
  isStandaloneOnboarded,
  setStandaloneOnboarded,
  type AppMode,
} from "./appConfig";
import { SystemBridge, type DeviceProfile, type InstalledApp, type KioskStatus } from "./native/SystemBridge";
import type { YouTubeChannelVideoResult } from "./native/SystemBridge";
import { isAllowedApp } from "./native/catalog";
import { loadAdminSettings, normalizeInactivityTimeoutMinutes, saveAdminSettings } from "./native/adminSettings";
import { clearAdminConfiguration } from "./native/adminAuth";
import { installKeyboardViewportTracking } from "./native/keyboard";
import { installDpadNavigation } from "./native/dpadNavigation";
import { recordDiagnostic } from "./native/diagnostics";

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
  youtubeItem?: KioskYouTubeItem;
  duration?: string;
  year?: number;
  rating?: string;
  matchPct?: number;
  badge?: "new" | "top10" | "trending";
  tileType?: "portrait" | "landscape";
}

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

function toYouTubeContentItem(item: KioskYouTubeItem): ContentItem {
  const displayTitle = displayTitleForYouTubeItem(item);
  return {
    id: `yt:${item.id}`,
    title: displayTitle,
    youtubeItem: item,
    imageUrl: item.kind === "video" ? thumbnailUrl(item.sourceId) : undefined,
    iconUrl: item.kind === "channel" ? item.thumbnailUrl : undefined,
    coverUrl: item.kind === "video" ? gradientFor(item.sourceId) : "#dc2626, #450a0a",
    description: item.kind === "channel"
      ? `Explore ${displayTitle}`
      : `Play ${displayTitle}`,
    genre: item.kind === "channel" ? "YouTube Channel" : item.kind === "playlist" ? "YouTube Playlist" : "YouTube Video",
    category: "youtube",
    tileType: "landscape",
  };
}

function restoreElementFocus(element: HTMLElement | null): void {
  window.setTimeout(() => {
    if (!element?.isConnected) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, 0);
}

function restoreContentTileFocus(contentId: string): void {
  window.setTimeout(() => {
    const tile = Array.from(document.querySelectorAll<HTMLElement>("[data-content-id]"))
      .find((element) => element.dataset.contentId === contentId);
    restoreElementFocus(tile ?? null);
  }, 0);
}

export default function App() {
  const [initialAdminSettings] = useState(loadAdminSettings);
  const [apps, setApps] = useState<ContentItem[]>([]);
  const [hiddenApps, setHiddenApps] = useState<Set<string>>(
    () => new Set(initialAdminSettings.hiddenAppIds),
  );
  const [featuredItem, setFeaturedItem] = useState<ContentItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"wifi" | "bluetooth">("wifi");
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [battery, setBattery] = useState({ level: -1, isCharging: false });
  const [wifi, setWifi] = useState({ connected: false, ssid: undefined as string | undefined });
  const [btConnected, setBtConnected] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [sleepTime, setSleepTime] = useState(new Date());
  const [inactivityTimeout, setInactivityTimeout] = useState(initialAdminSettings.inactivityTimeoutMinutes);
  const [allowSameChannelRecommendations, setAllowSameChannelRecommendations] = useState(
    initialAdminSettings.allowSameChannelRecommendations,
  );
  const lastActivityRef = useRef(Date.now());
  const launchingRef = useRef(false);
  const settingsReturnFocusRef = useRef<HTMLElement | null>(null);
  const adminReturnFocusRef = useRef<HTMLElement | null>(null);

  const [appMode, setAppMode] = useState<AppMode>(getAppMode());
  // Decided after first-run detection (see effect below); a stored choice wins.
  const [needsModeSetup, setNeedsModeSetup] = useState(false);
  // Standalone first-run only: gate the panel behind the onboarding wizard until
  // the operator has set a PIN, granted permissions, and picked apps.
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [youtubeItems, setYouTubeItems] = useState<KioskYouTubeItem[]>(initializeApprovedYouTubeItems());
  const [browsingYouTubeChannel, setBrowsingYouTubeChannel] = useState<KioskYouTubeItem | null>(null);
  const [playingYouTube, setPlayingYouTube] = useState<KioskYouTubeItem | null>(null);
  const [kioskStatus, setKioskStatus] = useState<KioskStatus | null>(null);
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile | null>(null);
  const isStandalone = appMode === "standalone";

  useEffect(() => installKeyboardViewportTracking(), []);
  useEffect(
    () => installDpadNavigation(!!deviceProfile?.remoteUi),
    [deviceProfile?.remoteUi],
  );

  const chooseAppMode = useCallback((mode: AppMode) => {
    persistAppMode(mode);
    setAppMode(mode);
    setNeedsModeSetup(false);
    // Fresh standalone setups run the onboarding wizard before the panel.
    if (mode === "standalone" && !isStandaloneOnboarded()) setNeedsOnboarding(true);
  }, []);

  // Onboarding's app picker reports the apps the operator left unchecked; hide
  // exactly those. Everything else (including apps installed later) shows by
  // default and stays fully manageable from the Admin Panel's Applications tab.
  const finishOnboarding = useCallback((hiddenPackages: string[]) => {
    setHiddenApps(new Set(hiddenPackages));
    setStandaloneOnboarded(true);
    setNeedsOnboarding(false);
  }, []);

  useEffect(() => {
    SystemBridge.setManagementMode({ mode: appMode }).catch((e) => {
      console.error("Failed to sync management mode", e);
    });
  }, [appMode]);

  useEffect(() => {
    SystemBridge.getDeviceProfile()
      .then((profile) => {
        setDeviceProfile(profile);
        recordDiagnostic("info", "Device profile detected", profile);
      })
      .catch((error) => console.error("Failed to detect device capabilities", error));
  }, []);

  const refreshKiosk = useCallback(async () => {
    try { setKioskStatus(await SystemBridge.getKioskStatus()); } catch (e) { console.error("Failed to read kiosk status", e); }
  }, []);

  const youtubeContentItems = [...youtubeItems]
    .sort((a, b) => b.addedAt - a.addedAt)
    .map(toYouTubeContentItem);

  useEffect(() => {
    const staleChannels = youtubeItems.filter(channelMetadataNeedsRefresh);
    if (staleChannels.length === 0) return;
    let cancelled = false;

    Promise.all(staleChannels.map(async (item) => {
      const channelId = channelIdForYouTubeItem(item);
      if (!channelId) return false;
      try {
        const response = await SystemBridge.getYouTubeChannelVideos({ channelId });
        const channelTitle = response.channelTitle.trim();
        if (!channelTitle || /^YouTube Channel$/i.test(channelTitle) || cancelled) {
          return false;
        }
        return addYouTubeItem(
          `https://www.youtube.com/channel/${channelId}`,
          channelTitle,
          item.thumbnailUrl,
        ) !== null;
      } catch (error) {
        console.warn("Could not refresh saved YouTube channel metadata", error);
        return false;
      }
    })).then((results) => {
      if (cancelled || !results.some(Boolean)) return;
      const refreshedItems = getYouTubeItems();
      setYouTubeItems(refreshedItems);
      setFeaturedItem((current) => {
        const youtubeItem = current?.youtubeItem;
        if (!youtubeItem) return current;
        const refreshed = refreshedItems.find((item) => item.id === youtubeItem.id);
        return refreshed ? toYouTubeContentItem(refreshed) : current;
      });
      setBrowsingYouTubeChannel((current) => {
        if (!current) return current;
        return refreshedItems.find((item) => item.id === current.id) ?? current;
      });
    });

    return () => { cancelled = true; };
  }, [youtubeItems]);

  const loadApps = useCallback(async () => {
    try {
      const { apps: installed } = await SystemBridge.getInstalledApps();
      const allowed = installed
        .filter((app) => isAllowedApp(app, appMode))
        .map(toContentItem);
      allowed.sort((a, b) => a.title.localeCompare(b.title));
      setApps(allowed);
      // Keep the current selection across refreshes (YouTube sources aren't in the
      // installed-apps list, so they'd otherwise be deselected every poll).
      setFeaturedItem(prev => prev && (prev.youtubeItem || allowed.some(a => a.id === prev.id)) ? prev : allowed[0] ?? null);
    } catch (e) {
      console.error("Failed to load apps", e);
    }
  }, [appMode]);

  // Refresh the panel's app list the moment onboarding finishes so the curated
  // selection appears immediately (the 60s poll would otherwise lag).
  useEffect(() => {
    if (!needsOnboarding) void loadApps();
  }, [needsOnboarding, loadApps]);

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

  const openSettings = useCallback((tab: "wifi" | "bluetooth") => {
    settingsReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    recordDiagnostic("info", "Settings opened", { tab });
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    recordDiagnostic("info", "Settings closed");
    setIsSettingsOpen(false);
    setIsAdmin(false);
    setIsAdminPanelOpen(false);
    refreshStatus();
    restoreElementFocus(settingsReturnFocusRef.current);
  }, [refreshStatus]);

  const openAdminPanel = useCallback(() => {
    adminReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    recordDiagnostic("info", "Admin Panel opened");
    setIsAdminPanelOpen(true);
    if (isStandalone) refreshKiosk();
  }, [isStandalone, refreshKiosk]);

  const closeAdminPanel = useCallback(() => {
    recordDiagnostic("info", "Admin Panel closed");
    setIsAdminPanelOpen(false);
    restoreElementFocus(adminReturnFocusRef.current);
  }, []);

  useEffect(() => {
    loadApps();
    refreshStatus();
    const statusTimer = setInterval(refreshStatus, 15000);
    const appsTimer = setInterval(loadApps, 60000);

    const onResume = () => {
      if (document.visibilityState === "visible") {
        recordDiagnostic("info", "OpenPanel returned to foreground");
        SystemBridge.getKioskStatus()
          .then((status) => recordDiagnostic("info", "Launcher state after foreground return", {
            managementMode: status.managementMode,
            arborXrManaged: status.arborXrManaged,
            defaultLauncher: status.defaultLauncher,
            lockTaskMode: status.lockTaskMode,
          }))
          .catch((error) => console.warn("Could not capture launcher return state", error));
        loadApps();
        refreshStatus();
      }
    };
    document.addEventListener("visibilitychange", onResume);

    // Reflect plug/unplug the instant it happens instead of waiting for the
    // 15s poll (which made the header read "charging" for a beat after the
    // charger was pulled). The poll stays as a backstop.
    let batteryListener: PluginListenerHandle | undefined;
    void SystemBridge.addListener("batteryChanged", (info) => setBattery(info))
      .then((handle) => { batteryListener = handle; });

    return () => {
      clearInterval(statusTimer);
      clearInterval(appsTimer);
      document.removeEventListener("visibilitychange", onResume);
      void batteryListener?.remove();
    };
  }, [loadApps, refreshStatus]);

  const handleLaunch = async (item: ContentItem) => {
    // Approved YouTube sources open the in-app player instead of another app.
    if (item.youtubeItem) {
      if (item.youtubeItem.kind === "channel") {
        recordDiagnostic("info", "YouTube channel browser opened", {
          channel: item.youtubeItem.title,
          sourceId: item.youtubeItem.sourceLabel,
        });
        setBrowsingYouTubeChannel(item.youtubeItem);
        setPlayingYouTube(null);
        return;
      }
      setPlayingYouTube(item.youtubeItem);
      return;
    }
    if (!item.packageName || launchingRef.current) return;
    launchingRef.current = true;
    try {
      recordDiagnostic("info", "Launching allowed application", {
        packageName: item.packageName,
        title: item.title,
      });
      await SystemBridge.launchApp({ packageName: item.packageName });
      recordDiagnostic("info", "External application launch accepted", {
        packageName: item.packageName,
        title: item.title,
      });
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
    lastActivityRef.current = Date.now();
    if (playingYouTube) setIsSleeping(false);
  }, [playingYouTube]);

  // Only keep the display on while a video is actually playing. The panel lets
  // the normal system screen timeout blank the display to save panel hours; the
  // device stays reachable on the network (adb / remote management) with the
  // screen off on its own — Android keeps Wi-Fi associated during screen-off.
  useEffect(() => {
    if (!playingYouTube) return;
    const syncScreenAwake = () => {
      SystemBridge.setKeepScreenOn({ enabled: document.visibilityState === "visible" })
        .catch((error) => console.error("Failed to update playback screen state", error));
    };
    syncScreenAwake();
    document.addEventListener("visibilitychange", syncScreenAwake);
    return () => {
      document.removeEventListener("visibilitychange", syncScreenAwake);
      SystemBridge.setKeepScreenOn({ enabled: false })
        .catch((error) => console.error("Failed to release playback screen state", error));
    };
  }, [playingYouTube]);

  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      setIsSleeping(false);
    };
    window.addEventListener("pointerdown", handleActivity);
    window.addEventListener("keydown", handleActivity);
    const check = setInterval(() => {
      if (playingYouTube) return;
      const inactive = (Date.now() - lastActivityRef.current) / 1000 / 60;
      if (inactive >= inactivityTimeout) setIsSleeping(true);
    }, 30000);
    return () => {
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      clearInterval(check);
    };
  }, [inactivityTimeout, playingYouTube]);

  useEffect(() => {
    if (!isSleeping) return;
    setSleepTime(new Date());
    const timer = setInterval(() => setSleepTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, [isSleeping]);

  useEffect(() => {
    saveAdminSettings({
      hiddenAppIds: Array.from(hiddenApps),
      inactivityTimeoutMinutes: inactivityTimeout,
      allowSameChannelRecommendations,
    });
  }, [allowSameChannelRecommendations, hiddenApps, inactivityTimeout]);

  const updateHiddenApps = useCallback((update: (current: Set<string>) => Set<string>) => {
    setHiddenApps((current) => update(current));
  }, []);

  const updateInactivityTimeout = useCallback((minutes: number) => {
    setInactivityTimeout(normalizeInactivityTimeoutMinutes(minutes));
    lastActivityRef.current = Date.now();
  }, []);

  const visibleApps = apps.filter(a => !hiddenApps.has(a.id));
  const featured = featuredItem && !hiddenApps.has(featuredItem.id) ? featuredItem : visibleApps[0] ?? null;

  return (
    <div
      data-dpad-scope
      data-device-type={deviceProfile?.deviceType ?? "detecting"}
      data-input-mode={deviceProfile?.remoteUi ? "remote" : deviceProfile?.touchUi ? "touch" : "detecting"}
      className="size-full bg-[oklch(11%_0_0)] overflow-y-auto overflow-x-hidden relative"
    >
      {/* Sleep Screen */}
      {isSleeping && (
        <div
          className="fixed inset-0 bg-black z-[200] flex items-center justify-center cursor-pointer"
          onClick={() => { lastActivityRef.current = Date.now(); setIsSleeping(false); }}
        >
          <div className="text-center select-none">
            <div className="text-[oklch(70%_0_0)] text-5xl mb-3 tracking-tight" style={{ fontWeight: 300 }}>
              {sleepTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
            </div>
            <div className="text-[oklch(38%_0_0)] text-sm tracking-widest uppercase">
              {deviceProfile?.remoteUi ? "Press any button to wake" : "Tap anywhere to wake"}
            </div>
          </div>
        </div>
      )}

      <StatusBar
        onSettingsClick={() => openSettings("wifi")}
        onWifiClick={() => openSettings("wifi")}
        onBluetoothClick={() => openSettings("bluetooth")}
        isWifiConnected={wifi.connected}
        wifiSsid={wifi.ssid}
        isBluetoothConnected={btConnected}
        batteryLevel={battery.level}
        isCharging={battery.isCharging}
        showBattery={deviceProfile?.showBattery === true}
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
              <p className="text-[oklch(38%_0_0)] text-sm mt-1">
                {isStandalone ? "Install an app on this device to see it here" : "Deploy apps from ArborXR to see them here"}
              </p>
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
          {youtubeContentItems.length > 0 && (
            <ContentRow
              title="YouTube"
              items={youtubeContentItems}
              selectedId={featured?.id ?? null}
              onSelect={setFeaturedItem}
              onLaunch={handleLaunch}
            />
          )}
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        isStandalone={isStandalone}
        onExitKiosk={async () => {
          try {
            await SystemBridge.exitKioskToSystemHome();
          } catch (e) { console.error("exit kiosk", e); }
          refreshKiosk();
        }}
        isAdmin={isAdmin}
        onEnterAdmin={() => setIsAdmin(true)}
        onExitAdmin={() => { setIsAdmin(false); setIsAdminPanelOpen(false); }}
        onOpenAdminPanel={openAdminPanel}
        deviceProfile={deviceProfile}
        initialTab={settingsTab}
        onNetworkChange={refreshStatus}
      />

      <AdminPanel
        isOpen={isAdminPanelOpen}
        onClose={closeAdminPanel}
        apps={visibleApps.map(g => ({
          id: g.id, name: g.title, icon: Gamepad2,
          gradient: `bg-gradient-to-br from-[${g.coverUrl.split(", ")[0]}] to-[${g.coverUrl.split(", ")[1]}]`
        }))}
        availableApps={apps.map(g => ({
          id: g.id, name: g.title, icon: Gamepad2,
          gradient: `bg-gradient-to-br from-[${g.coverUrl.split(", ")[0]}] to-[${g.coverUrl.split(", ")[1]}]`
        }))}
        onAddApp={(id) => updateHiddenApps((current) => { const next = new Set(current); next.delete(id); return next; })}
        onRemoveApp={(id) => updateHiddenApps((current) => new Set(current).add(id))}
        inactivityTimeout={inactivityTimeout}
        onSetInactivityTimeout={updateInactivityTimeout}
        allowSameChannelRecommendations={allowSameChannelRecommendations}
        onSetAllowSameChannelRecommendations={setAllowSameChannelRecommendations}
        videos={youtubeItems}
        onAddVideo={(url, title, artworkUrl) => {
          const item = addYouTubeItem(url, title, artworkUrl);
          if (!item) return false;
          setYouTubeItems(getYouTubeItems());
          setFeaturedItem(toYouTubeContentItem(item));
          return true;
        }}
        onRemoveVideo={(id) => { removeYouTubeItem(id); setYouTubeItems(getYouTubeItems()); }}
        deviceProfile={deviceProfile}
        standalone={isStandalone}
        appMode={appMode}
        onSetAppMode={chooseAppMode}
        kioskStatus={kioskStatus}
        onRefreshKiosk={refreshKiosk}
        onSetDefaultLauncher={() => SystemBridge.openLauncherSettings()}
        onRequestDeviceAdmin={async () => { try { await SystemBridge.requestDeviceAdmin(); } catch (e) { console.error("device admin", e); } setTimeout(refreshKiosk, 500); }}
        onLockKiosk={async () => {
          const packages = visibleApps.map(a => a.packageName).filter((p): p is string => !!p);
          try { await SystemBridge.enableKioskLock({ packages }); } catch (e) { console.error("lock kiosk", e); }
          refreshKiosk();
        }}
        onUnlockKiosk={async () => { try { await SystemBridge.disableKioskLock(); } catch (e) { console.error("unlock kiosk", e); } refreshKiosk(); }}
        onClearDeviceOwner={async () => { try { await SystemBridge.clearDeviceOwner(); } catch (e) { console.error("clear device owner", e); } setTimeout(refreshKiosk, 500); }}
        onResetAdmin={() => {
          clearAdminConfiguration();
          setIsAdmin(false);
          setIsAdminPanelOpen(false);
        }}
      />

      {playingYouTube && (
        <YouTubePlayer
          item={playingYouTube}
          allowSameChannelRecommendations={allowSameChannelRecommendations}
          onClose={() => {
            const returnId = browsingYouTubeChannel ? null : `yt:${playingYouTube.id}`;
            lastActivityRef.current = Date.now();
            setPlayingYouTube(null);
            if (returnId) restoreContentTileFocus(returnId);
          }}
        />
      )}

      {browsingYouTubeChannel && (
        <YouTubeChannelBrowser
          item={browsingYouTubeChannel}
          active={!playingYouTube}
          onClose={() => {
            const returnId = `yt:${browsingYouTubeChannel.id}`;
            recordDiagnostic("info", "YouTube channel browser closed");
            setBrowsingYouTubeChannel(null);
            restoreContentTileFocus(returnId);
          }}
          onPlay={(video: YouTubeChannelVideoResult) => {
            setPlayingYouTube({
              id: `video:${video.videoId}`,
              kind: "video",
              sourceId: video.videoId,
              sourceLabel: video.videoId,
              title: video.title,
              thumbnailUrl: video.thumbnailUrl,
              addedAt: Date.parse(video.publishedAt) || Date.now(),
            });
          }}
        />
      )}

      {needsModeSetup && <ModeSetup onChoose={chooseAppMode} />}

      {needsOnboarding && (
        <StandaloneOnboarding deviceProfile={deviceProfile} onComplete={finishOnboarding} />
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        [data-dpad-scope] :focus-visible {
          outline: 3px solid rgba(255, 255, 255, 0.95) !important;
          outline-offset: 3px;
        }
      `}</style>
    </div>
  );
}
