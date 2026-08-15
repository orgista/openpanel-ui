import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { StatusBar } from "./StatusBar";

describe("StatusBar", () => {
  it("names every interactive system control for remote and assistive input", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        onSettingsClick={vi.fn()}
        onWifiClick={vi.fn()}
        onBluetoothClick={vi.fn()}
        isWifiConnected
        wifiSsid="Dev Network"
        isBluetoothConnected
        batteryLevel={85}
      />,
    );

    expect(html).toContain('aria-label="Wi-Fi: Dev Network"');
    expect(html).toContain('aria-label="Bluetooth connected"');
    expect(html).toContain('aria-label="Open settings"');
    expect(html).toContain('aria-label="OpenPanel by Orgista"');
  });

  it.each([
    { level: 100, tone: "white" },
    { level: 40, tone: "white" },
    { level: 39, tone: "yellow" },
    { level: 20, tone: "yellow" },
    { level: 19, tone: "red" },
  ])("fills the battery at $level% using the $tone range", ({ level, tone }) => {
    const html = renderToStaticMarkup(
      <StatusBar
        onSettingsClick={vi.fn()}
        isWifiConnected
        isBluetoothConnected={false}
        batteryLevel={level}
      />,
    );

    expect(html).toContain(`aria-label="Battery ${level}%"`);
    expect(html).toContain(`data-battery-tone="${tone}"`);
    expect(html).toContain(`data-battery-fill="${level}"`);
    expect(html).toContain('viewBox="0 0 30 14"');
    expect(html).toContain(`width="${level}"`);
  });

  it("uses a single scalable gauge and keeps charging state accessible", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        onSettingsClick={vi.fn()}
        isWifiConnected
        isBluetoothConnected={false}
        batteryLevel={62}
        isCharging
      />,
    );

    expect(html).toContain('data-battery-gauge="true"');
    expect(html).toContain('class="h-2.5 w-[21px] overflow-visible"');
    expect(html).toContain('aria-label="Battery 62%, charging"');
    expect(html).toContain('data-charging-bolt="true"');
  });

  it("omits battery UI and warnings for television profiles", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        onSettingsClick={vi.fn()}
        isWifiConnected
        isBluetoothConnected={false}
        batteryLevel={10}
        showBattery={false}
      />,
    );

    expect(html).not.toContain("data-battery-gauge");
    expect(html).not.toContain('aria-label="Battery 10%"');
    expect(html).not.toContain("Low battery — please charge soon");
  });
});
