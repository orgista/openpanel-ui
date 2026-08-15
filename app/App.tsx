import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { StandaloneOnboarding, PinStep } from "./components/StandaloneOnboarding";
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
import { allowedAppsForDevice } from "./native/catalog";
import { loadAdminSettings, normalizeInactivityTimeoutMinutes, saveAdminSettings } from "./native/adminSettings";
import { clearAdminConfiguration, isAdminConfigured } from "./native/adminAuth";
import { installKeyboardViewportTracking } from "./native/keyboard";
import { installDpadNavigation } from "./native/dpadNavigation";
import { televisionCanvasScale, televisionCanvasStyle } from "./native/tvLayout";
import { recordDiagnostic } from "./native/diagnostics";
import { LibraryBridge, type LibraryPublication } from "./native/LibraryBridge";
import { LibraryCatalogBrowser } from "./components/LibraryCatalogBrowser";
import { OpenPanelBrand } from "./components/OpenPanelBrand";
import { MotionConfig } from "motion/react";

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
  libraryPublication?: LibraryPublication;
  libraryAction?: "browse";
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

function toLibraryContentItem(publication: LibraryPublication): ContentItem {
  const audio = publication.format === "audiobook" || publication.format === "audio";
  return {
    id: `library:${publication.id}`,
    title: publication.title,
    libraryPublication: publication,
    imageUrl: publication.coverUrl ?? undefined,
    coverUrl: audio ? "#7c3aed, #2e1065" : "#2563eb, #172554",
    description: `${publication.authors.join(", ") || "Unknown author"}${publication.progression ? ` · ${Math.round(publication.progression * 100)}% complete` : ""}`,
    genre: audio ? "Audiobook" : publication.format.toUpperCase(),
    category: "library",
    tileType: "portrait",
  };
}

const browseLibraryItem: ContentItem = {
  id: "library:browse",
  title: "Browse Library",
  libraryAction: "browse",
  coverUrl: "#0f766e, #042f2e",
  description: "Explore approved OPDS catalogs and save books or audiobooks for offline use.",
  genre: "Library Catalogs",
  category: "library",
  tileType: "portrait",
};

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
  const [manageNotifications, setManageNotifications] = useState(
    initialAdminSettings.manageNotifications,
  );
  const [libraryEnabled, setLibraryEnabled] = useState(initialAdminSettings.libraryEnabled);
  const lastActivityRef = useRef(Date.now());
  const launchingRef = useRef(false);
  const settingsReturnFocusRef = useRef<HTMLElement | null>(null);
  const adminReturnFocusRef = useRef<HTMLElement | null>(null);

  const [appMode, setAppMode] = useState<AppMode>(getAppMode());
  const [managementResolved, setManagementResolved] = useState(false);
  // Decided after first-run detection (see effect below); a stored choice wins.
  const [needsModeSetup, setNeedsModeSetup] = useState(false);
  // Standalone first-run only: gate the panel behind the onboarding wizard until
  // the operator has set a PIN, granted permissions, and picked apps.
  const [needsOnboarding, setNeedsOnboarding] = useState(
    () => getAppMode() === "standalone" && !isStandaloneOnboarded(),
  );
  // Companion devices skip the standalone onboarding wizard (ArborXR owns
  // lockdown), so nothing there forces an admin PIN. Track whether a local admin
  // credential exists; when it doesn't on a companion device we force PIN
  // creation before the kiosk is usable (see needsCompanionAdminSetup below), so
  // a child can't be the first to create one from Settings -> Admin Mode.
  const [adminConfigured, setAdminConfigured] = useState(() => isAdminConfigured());
  const [youtubeItems, setYouTubeItems] = useState<KioskYouTubeItem[]>(initializeApprovedYouTubeItems());
  const [browsingYouTubeChannel, setBrowsingYouTubeChannel] = useState<KioskYouTubeItem | null>(null);
  const [playingYouTube, setPlayingYouTube] = useState<KioskYouTubeItem | null>(null);
  const [libraryPublications, setLibraryPublications] = useState<LibraryPublication[]>([]);
  const [isLibraryBrowserOpen, setIsLibraryBrowserOpen] = useState(false);
  const [kioskStatus, setKioskStatus] = useState<KioskStatus | null>(null);
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile | null>(null);
  const isStandalone = appMode === "standalone";
  // Force first-time admin PIN creation on companion devices before the panel is
  // reachable. Standalone's onboarding wizard already guarantees a PIN, so this
  // gate only applies to companion mode; it also re-triggers if the admin
  // credential is later cleared (e.g. Reset Admin) while in companion mode.
  const needsCompanionAdminSetup =
    appMode === "companion" && managementResolved && !needsModeSetup && !adminConfigured;
  const panelReady = managementResolved && !needsModeSetup && !needsOnboarding && !needsCompanionAdminSetup;
  const legacyTelevision = deviceProfile?.isTelevision === true
    && (deviceProfile.sdk ?? 999) <= 28;
  const libraryAvailable = deviceProfile !== null && deviceProfile.isTelevision !== true;
  const televisionScale = televisionCanvasScale(
    deviceProfile?.isTelevision === true,
    typeof window === "undefined" ? 1600 : window.innerWidth,
  );

  useEffect(() => installKeyboardViewportTracking(), []);
  useEffect(
    () => installDpadNavigation(
      !!deviceProfile?.remoteUi,
      deviceProfile?.isTelevision === true && (deviceProfile.sdk ?? 999) <= 28,
    ),
    [deviceProfile?.isTelevision, deviceProfile?.remoteUi, deviceProfile?.sdk],
  );

  const chooseAppMode = useCallback((mode: AppMode) => {
    // Persist even when the choice matches the in-memory default. Previously,
    // choosing companion mode could appear to work but prompt again next boot.
    persistAppMode(mode);
    setAppMode(mode);
    setNeedsModeSetup(false);
    setManagementResolved(true);
    // Fresh standalone setups run the onboarding wizard before the panel.
    setNeedsOnboarding(mode === "standalone" && !isStandaloneOnboarded());
  }, []);

  // Onboarding's app picker reports the apps the operator left unchecked; hide
  // exactly those. Everything else (including apps installed later) shows by
  // default and stays fully manageable from the Admin Panel's Applications tab.
  const finishOnboarding = useCallback((hiddenPackages: string[]) => {
    setHiddenApps(new Set(hiddenPackages));
    // Optional setup can add approved YouTube channels after this component's
    // initial state was created. Refresh immediately so the new tile appears
    // on the launcher without requiring an app restart.
    setYouTubeItems(getYouTubeItems());
    if (libraryAvailable) {
      void LibraryBridge.listPublications()
        .then(({ publications }) => setLibraryPublications(publications))
        .catch((error) => console.error("Failed to refresh onboarding library", error));
    } else {
      setLibraryPublications([]);
    }
    setStandaloneOnboarded(true);
    setNeedsOnboarding(false);
  }, [libraryAvailable]);

  useEffect(() => {
    SystemBridge.setManagementMode({ mode: appMode }).catch((e) => {
      console.error("Failed to sync management mode", e);
    });
  }, [appMode]);

  useEffect(() => {
    SystemBridge.setNotificationManagement({ enabled: manageNotifications })
      .then((result) => recordDiagnostic("info", "Notification policy synced", {
        enabled: manageNotifications,
        available: result.available,
        changed: result.changed ?? 0,
      }))
      .catch((error) => console.error("Failed to sync notification policy", error));
  }, [manageNotifications]);

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

  const youtubeContentItems = useMemo(
    () => [...youtubeItems]
      .sort((a, b) => b.addedAt - a.addedAt)
      .map(toYouTubeContentItem),
    [youtubeItems],
  );
  const libraryContentItems = useMemo(
    () => [
      browseLibraryItem,
      ...[...libraryPublications]
        .sort((a, b) => (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt))
        .map(toLibraryContentItem),
    ],
    [libraryPublications],
  );

  const loadLibrary = useCallback(async () => {
    if (!libraryAvailable) {
      setLibraryPublications([]);
      return;
    }
    try {
      const { publications } = await LibraryBridge.listPublications();
      setLibraryPublications(publications);
    } catch (error) {
      console.error("Failed to load books and audio", error);
    }
  }, [libraryAvailable]);

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
      const [{ apps: installed }, management] = await Promise.all([
        SystemBridge.getInstalledApps(),
        appMode === "companion"
          ? SystemBridge.getKioskStatus().catch((error) => {
              console.warn("Could not verify ArborXR management while loading apps", error);
              return null;
            })
          : Promise.resolve(null),
      ]);
      if (management) setKioskStatus(management);
      const allowed = allowedAppsForDevice(
        installed,
        appMode,
        // Treat an unreadable management state as managed. The fallback must
        // only activate after Android positively reports that ArborXR is not
        // the Device Owner.
        management?.arborXrManaged ?? true,
      )
        .map(toContentItem);
      allowed.sort((a, b) => a.title.localeCompare(b.title));
      setApps(allowed);
      // Keep the current selection across refreshes (YouTube sources aren't in the
      // installed-apps list, so they'd otherwise be deselected every poll).
      setFeaturedItem(prev => prev && (
        prev.youtubeItem || prev.libraryPublication || prev.libraryAction || allowed.some(a => a.id === prev.id)
      ) ? prev : allowed[0] ?? null);
    } catch (e) {
      console.error("Failed to load apps", e);
    }
  }, [appMode]);

  const refreshStatus = useCallback(async () => {
    try {
      const [bat, wf, bt] = await Promise.all([
        deviceProfile?.showBattery === true
          ? SystemBridge.getBatteryInfo()
          : Promise.resolve(null),
        SystemBridge.getWifiStatus(),
        SystemBridge.getBluetoothStatus(),
      ]);
      if (bat) setBattery(bat);
      setWifi({ connected: wf.connected, ssid: wf.ssid });
      setBtConnected(!!bt.enabled && !!bt.devices?.some(d => d.connected));
    } catch (e) {
      console.error("Failed to refresh status", e);
    }
  }, [deviceProfile?.showBattery]);

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
    if (!panelReady) return;
    loadApps();
    loadLibrary();
    refreshStatus();
    const statusTimer = setInterval(
      refreshStatus,
      deviceProfile?.isTelevision === true ? 30000 : 15000,
    );
    const appsTimer = setInterval(loadApps, 60000);

    const onResume = () => {
      if (document.visibilityState === "visible") {
        recordDiagnostic("info", "OpenPanel returned to foreground");
        SystemBridge.getKioskStatus()
          .then((status) => recordDiagnostic("info", "Launcher state after foreground return", {
            managementMode: status.managementMode,
            arborXrManaged: status.arborXrManaged,
            defaultLauncher: status.defaultLauncher,
            homeControlMode: status.homeControlMode,
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
    if (deviceProfile?.showBattery === true) {
      void SystemBridge.addListener("batteryChanged", (info) => setBattery(info))
        .then((handle) => { batteryListener = handle; });
    }

    return () => {
      clearInterval(statusTimer);
      clearInterval(appsTimer);
      document.removeEventListener("visibilitychange", onResume);
      void batteryListener?.remove();
    };
  }, [deviceProfile?.isTelevision, deviceProfile?.showBattery, loadApps, loadLibrary, panelReady, refreshStatus]);

  const handleLaunch = async (item: ContentItem) => {
    if (item.libraryAction === "browse") {
      recordDiagnostic("info", "Library catalog browser opened");
      setIsLibraryBrowserOpen(true);
      return;
    }
    if (item.libraryPublication) {
      try {
        recordDiagnostic("info", "Publication opened", {
          id: item.libraryPublication.id,
          format: item.libraryPublication.format,
        });
        await LibraryBridge.openPublication({ id: item.libraryPublication.id });
        await loadLibrary();
      } catch (error) {
        console.error("Failed to open publication", error);
      }
      return;
    }
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

  // Fire OS always uses OpenPanel's standalone Home/accessibility kiosk path.
  // Other devices retain a stored choice; on first run ArborXR ownership is
  // detected before the management prompt is shown.
  useEffect(() => {
    if (!deviceProfile) return;
    if (deviceProfile.isFireOs) {
      setNeedsModeSetup(false);
      if (appMode !== "standalone" || !isAppModeConfigured()) {
        chooseAppMode("standalone");
      } else {
        setManagementResolved(true);
      }
      return;
    }
    if (isAppModeConfigured()) {
      setManagementResolved(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const k = await SystemBridge.getKioskStatus();
        if (cancelled) return;
        if (k.arborXrManaged) { chooseAppMode("companion"); return; }
      } catch (e) {
        console.error("Management detection failed", e);
      }
      if (!cancelled) {
        setNeedsModeSetup(true);
        setManagementResolved(true);
      }
    })();
    return () => { cancelled = true; };
  }, [appMode, chooseAppMode, deviceProfile]);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    if (playingYouTube) setIsSleeping(false);
  }, [playingYouTube]);

  // Televisions are fixed, powered displays and must remain available for the
  // remote and ADB troubleshooting. Tablets retain the battery-friendly rule
  // of keeping the screen awake only during playback.
  useEffect(() => {
    const shouldKeepAwake = deviceProfile?.isTelevision === true || !!playingYouTube;
    if (!shouldKeepAwake) return;
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
  }, [deviceProfile?.isTelevision, playingYouTube]);

  // Android 9 TCL televisions need software WebView rendering during setup so
  // D-pad focus repaints remain visible. The longer launcher surface stays on
  // hardware rendering to avoid exhausting the legacy compositor's tile pool.
  useEffect(() => {
    if (deviceProfile?.isTelevision !== true) return;
    SystemBridge.setLegacyTvCompatRendering({
      enabled: needsModeSetup || needsOnboarding,
    }).catch((error) => console.error("Failed to update legacy TV rendering mode", error));
  }, [deviceProfile?.isTelevision, needsModeSetup, needsOnboarding]);

  useEffect(() => {
    if (deviceProfile?.isTelevision === true) {
      setIsSleeping(false);
      return;
    }
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
  }, [deviceProfile?.isTelevision, inactivityTimeout, playingYouTube]);

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
      manageNotifications,
      libraryEnabled,
    });
  }, [allowSameChannelRecommendations, hiddenApps, inactivityTimeout, libraryEnabled, manageNotifications]);

  const updateHiddenApps = useCallback((update: (current: Set<string>) => Set<string>) => {
    setHiddenApps((current) => update(current));
  }, []);

  const updateInactivityTimeout = useCallback((minutes: number) => {
    setInactivityTimeout(normalizeInactivityTimeoutMinutes(minutes));
    lastActivityRef.current = Date.now();
  }, []);

  const visibleApps = apps.filter(a => !hiddenApps.has(a.id));
  const featured = featuredItem
    && !hiddenApps.has(featuredItem.id)
    && (libraryAvailable && libraryEnabled
      || (!featuredItem.libraryPublication && !featuredItem.libraryAction))
    ? featuredItem
    : visibleApps[0]
      ?? (libraryAvailable && libraryEnabled ? libraryContentItems[0] : null)
      ?? youtubeContentItems[0]
      ?? null;

  return (
    <MotionConfig reducedMotion={legacyTelevision ? "always" : "user"}>
      <div
        data-dpad-scope
        data-device-type={deviceProfile?.deviceType ?? "detecting"}
        data-legacy-tv={legacyTelevision ? "true" : "false"}
        data-input-mode={deviceProfile?.remoteUi ? "remote" : deviceProfile?.touchUi ? "touch" : "detecting"}
        className="openpanel-shell size-full bg-[oklch(11%_0_0)] overflow-y-auto overflow-x-hidden relative"
        style={televisionCanvasStyle(televisionScale)}
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
            remoteMode={deviceProfile?.remoteUi === true}
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
          {libraryAvailable && libraryEnabled && (
            <ContentRow
              title="Books & Audio"
              items={libraryContentItems}
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
          iconUrl: g.iconUrl,
        }))}
        availableApps={apps.map(g => ({
          id: g.id, name: g.title, icon: Gamepad2,
          iconUrl: g.iconUrl,
        }))}
        onAddApp={(id) => updateHiddenApps((current) => { const next = new Set(current); next.delete(id); return next; })}
        onRemoveApp={(id) => updateHiddenApps((current) => new Set(current).add(id))}
        inactivityTimeout={inactivityTimeout}
        onSetInactivityTimeout={updateInactivityTimeout}
        allowSameChannelRecommendations={allowSameChannelRecommendations}
        onSetAllowSameChannelRecommendations={setAllowSameChannelRecommendations}
        manageNotifications={manageNotifications}
        onSetManageNotifications={setManageNotifications}
        libraryEnabled={libraryEnabled}
        onSetLibraryEnabled={setLibraryEnabled}
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
          try {
            await SystemBridge.enableKioskLock({ packages });
            await refreshKiosk();
          } catch (e) {
            console.error("lock kiosk", e);
            await refreshKiosk();
            throw e;
          }
        }}
        onUnlockKiosk={async () => {
          try {
            await SystemBridge.disableKioskLock();
            await refreshKiosk();
          } catch (e) {
            console.error("unlock kiosk", e);
            await refreshKiosk();
            throw e;
          }
        }}
        onClearDeviceOwner={async () => { try { await SystemBridge.clearDeviceOwner(); } catch (e) { console.error("clear device owner", e); } setTimeout(refreshKiosk, 500); }}
        onResetAdmin={() => {
          clearAdminConfiguration();
          setAdminConfigured(false);
          setIsAdmin(false);
          setIsAdminPanelOpen(false);
        }}
        onLibraryChanged={loadLibrary}
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

      {libraryAvailable && isLibraryBrowserOpen && (
        <LibraryCatalogBrowser
          onClose={() => {
            recordDiagnostic("info", "Library catalog browser closed");
            setIsLibraryBrowserOpen(false);
            restoreContentTileFocus("library:browse");
          }}
          onLibraryChanged={loadLibrary}
        />
      )}

      {needsModeSetup && (
        <ModeSetup
          onChoose={chooseAppMode}
          isTelevision={deviceProfile?.isTelevision === true}
          isFireOs={deviceProfile?.isFireOs === true}
        />
      )}

      {needsOnboarding && (
        <StandaloneOnboarding
          deviceProfile={deviceProfile}
          manageNotifications={manageNotifications}
          onSetManageNotifications={setManageNotifications}
          onComplete={finishOnboarding}
        />
      )}

      {/* Companion first-run gate: force an admin PIN before the kiosk is usable
          so a child can't claim admin by being the first to set one. Reuses the
          onboarding PinStep (PIN -> confirm -> recovery question); it has no
          skip/cancel that dismisses, so the panel stays covered until a PIN
          exists. */}
      {needsCompanionAdminSetup && (
        <div
          data-dpad-scope
          data-input-mode={deviceProfile?.remoteUi ? "remote" : "touch"}
          className="fixed inset-0 z-[300] overflow-y-auto bg-[oklch(11%_0_0)] p-6 sm:p-10"
        >
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <OpenPanelBrand iconClassName="size-12" wordmarkClassName="text-3xl sm:text-4xl" />
              </div>
              <h1 className="text-xl sm:text-2xl text-[oklch(85%_0_0)] mb-2" style={{ fontWeight: 500 }}>
                Secure this device
              </h1>
              <p className="text-[oklch(70.8%_0_0)]">
                Create an admin PIN before handing the device to a child. It's required to open Settings and Admin Mode.
              </p>
            </div>
            <PinStep deviceProfile={deviceProfile} onDone={() => setAdminConfigured(true)} />
          </div>
        </div>
      )}

      {!managementResolved && !needsModeSetup && (
        <div
          data-dpad-scope
          data-input-mode={deviceProfile?.remoteUi ? "remote" : "detecting"}
          className="fixed inset-0 z-[350] flex flex-col items-center justify-center gap-5 bg-black"
        >
          <OpenPanelBrand iconClassName="size-16" wordmarkClassName="text-5xl" />
          <p className="text-lg text-[oklch(65%_0_0)]">Checking device management…</p>
        </div>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        [data-dpad-scope] :focus-visible {
          outline: 3px solid rgba(255, 255, 255, 0.95) !important;
          outline-offset: 3px;
        }
        [data-input-mode="remote"] :focus,
        [data-input-mode="remote"] :focus-visible {
          --tw-ring-shadow: 0 0 #0000 !important;
          --tw-ring-offset-shadow: 0 0 #0000 !important;
          box-shadow: none !important;
          outline-width: 4px !important;
        }
      `}</style>
      </div>
    </MotionConfig>
  );
}
