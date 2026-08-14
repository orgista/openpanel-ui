import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Network,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { SystemBridge, type DnsFilterStatus } from "../native/SystemBridge";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80 disabled:opacity-50 transition-colors";

function privateDnsLabel(status: DnsFilterStatus): string {
  if (status.privateDnsMode === "hostname") {
    return status.privateDnsHost ? `Provider: ${status.privateDnsHost}` : "Custom provider";
  }
  if (status.privateDnsMode === "opportunistic") return "Automatic encrypted DNS";
  if (status.privateDnsMode === "off") return "Off (correct for a local DNS VPN)";
  return "Unavailable on this TV";
}

export function NetworkPrivacyPanel() {
  const [status, setStatus] = useState<DnsFilterStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy("refresh");
    try {
      setStatus(await SystemBridge.getDnsFilterStatus());
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Network protection could not be read.");
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (key: string, action: () => Promise<void | DnsFilterStatus>) => {
    setBusy(key);
    setMessage(null);
    try {
      const next = await action();
      if (next) setStatus(next);
      else setStatus(await SystemBridge.getDnsFilterStatus());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The network action failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="network-privacy-heading" className="mt-10 border-t border-[oklch(35%_0_0)] pt-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Network className="size-5 text-[oklch(70%_0.18_255)]" />
            <h3 id="network-privacy-heading" className="text-xl text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>
              DNS &amp; Telemetry
            </h3>
          </div>
          <p className="text-sm text-[oklch(70.8%_0_0)]">
            TV-only status for personalDNSfilter, always-on VPN, and Android Private DNS.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy !== null}
          className={`${buttonClass} bg-[oklch(26.9%_0_0)] text-[oklch(90%_0_0)] hover:bg-[oklch(33%_0_0)]`}
        >
          <RefreshCw className={`size-4 ${busy === "refresh" ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {!status ? (
        <div role="status" className="flex items-center gap-3 py-8 text-[oklch(70.8%_0_0)]">
          <Loader2 className="size-5 animate-spin" /> Detecting network protection…
        </div>
      ) : (
        <>
          <div className={`rounded-xl border p-4 ${status.filterActive
            ? "border-[oklch(55%_0.15_150)]/50 bg-[oklch(28%_0.08_150)]/40"
            : "border-[oklch(65%_0.16_70)]/50 bg-[oklch(28%_0.08_70)]/40"}`}>
            <div className="flex items-start gap-3">
              {status.filterActive
                ? <ShieldCheck className="size-5 shrink-0 mt-0.5 text-[oklch(72%_0.15_150)]" />
                : <ShieldOff className="size-5 shrink-0 mt-0.5 text-[oklch(75%_0.16_70)]" />}
              <div>
                <p className="text-[oklch(94%_0_0)]" style={{ fontWeight: 500 }}>
                  {status.filterActive ? "DNS filtering is active" : "DNS filtering is not active"}
                </p>
                <p className="text-sm text-[oklch(72%_0_0)] mt-1">
                  {status.installed
                    ? `personalDNSfilter${status.versionName ? ` ${status.versionName}` : ""} is ${status.enabled ? "enabled" : "disabled"}.`
                    : "Install personalDNSfilter as a separate managed app, then configure its TV-safe blocklist."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-[oklch(35%_0_0)] bg-[oklch(24%_0_0)] p-4">
              <div className="text-xs uppercase tracking-wide text-[oklch(65%_0_0)]">Filter VPN</div>
              <div className="mt-1 text-[oklch(94%_0_0)]">{status.filterActive ? "Connected" : status.vpnActive ? "Another VPN active" : "Disconnected"}</div>
            </div>
            <div className="rounded-xl border border-[oklch(35%_0_0)] bg-[oklch(24%_0_0)] p-4">
              <div className="text-xs uppercase tracking-wide text-[oklch(65%_0_0)]">Always-on</div>
              <div className="mt-1 text-[oklch(94%_0_0)]">{status.alwaysOn ? status.lockdown ? "On + lockdown" : "On" : "Off"}</div>
            </div>
            <div className="rounded-xl border border-[oklch(35%_0_0)] bg-[oklch(24%_0_0)] p-4">
              <div className="text-xs uppercase tracking-wide text-[oklch(65%_0_0)]">Private DNS</div>
              <div className="mt-1 text-sm text-[oklch(94%_0_0)]">{privateDnsLabel(status)}</div>
            </div>
          </div>

          {status.privateDnsMayBypassFilter && (
            <p role="alert" className="rounded-xl border border-[oklch(65%_0.16_70)]/50 bg-[oklch(28%_0.08_70)]/40 p-4 text-sm text-[oklch(86%_0.08_70)]">
              Private DNS can bypass this local DNS filter. Turn Private DNS off while personalDNSfilter is active.
            </p>
          )}

          {status.installed && !status.filterActive && (
            <p role="alert" className="rounded-xl border border-[oklch(65%_0.16_70)]/50 bg-[oklch(28%_0.08_70)]/40 p-4 text-sm text-[oklch(86%_0.08_70)]">
              This filter's setup screen is phone-oriented and can rotate older TV firmware. Provision its one-time VPN approval through the device deployment workflow, then use OpenPanel to verify status. Opening the phone UI is intentionally disabled here.
            </p>
          )}

          {message && (
            <p role="status" className="rounded-xl border border-[oklch(43.9%_0_0)] bg-[oklch(26.9%_0_0)] p-4 text-sm text-[oklch(85%_0_0)]">
              {message}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {status.installed && status.canManageAlwaysOn && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run("always-on", () => SystemBridge.setDnsFilterAlwaysOn({ enabled: !status.alwaysOn }))}
                className={`${buttonClass} bg-[oklch(26.9%_0_0)] text-white hover:bg-[oklch(33%_0_0)]`}
              >
                {status.alwaysOn ? "Stop always-on" : "Keep filter always on"}
              </button>
            )}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run("vpn-settings", () => SystemBridge.openVpnSettings())}
              className={`${buttonClass} bg-[oklch(26.9%_0_0)] text-white hover:bg-[oklch(33%_0_0)]`}
            >
              VPN settings
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run("private-dns", () => SystemBridge.openPrivateDnsSettings())}
              className={`${buttonClass} bg-[oklch(26.9%_0_0)] text-white hover:bg-[oklch(33%_0_0)]`}
            >
              Private DNS settings
            </button>
          </div>

          <p className="text-xs text-[oklch(62%_0_0)]">
            Blocking telemetry can reduce background requests and data use, but resolver latency and an oversized blocklist can make a TV slower. DNS also cannot block traffic sent to hard-coded IPs or an app’s own encrypted resolver.
          </p>
          {status.filterActive && (
            <p className="text-xs text-[oklch(70.8%_0_0)]">
              The filter is already provisioned. OpenPanel keeps its phone-only configuration screen out of the TV navigation path and reports the live VPN state here.
            </p>
          )}
          {status.arborXrManaged && !status.canManageAlwaysOn && (
            <p className="text-xs text-[oklch(70.8%_0_0)]">
              ArborXR owns device policy on this TV, so OpenPanel reports the VPN state but does not override it.
            </p>
          )}
        </>
      )}
    </section>
  );
}
