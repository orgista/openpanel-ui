// PARKED — not currently wired into the app.
//
// This was the "Stremio Add-ons" tab in the Admin Panel. Removed from the
// active UI on 2026-06-11 per request, kept here intact in case it comes back.
// To restore: re-add a "stremio" tab in AdminPanel.tsx, pass the props back
// through App.tsx, and render <StremioAddonsPanel ... />.

import { useState } from "react";
import { Trash2 } from "lucide-react";

export interface StremioAddon {
  id: string;
  name: string;
  url: string;
}

interface StremioAddonsPanelProps {
  stremioEnabled: boolean;
  onToggleStremio: (enabled: boolean) => void;
  stremioAddons: StremioAddon[];
  onAddStremioAddon: (addon: StremioAddon) => void;
  onRemoveStremioAddon: (addonId: string) => void;
}

export function StremioAddonsPanel({
  stremioEnabled,
  onToggleStremio,
  stremioAddons,
  onAddStremioAddon,
  onRemoveStremioAddon,
}: StremioAddonsPanelProps) {
  const [newAddonUrl, setNewAddonUrl] = useState("");
  const [newAddonName, setNewAddonName] = useState("");

  const handleAddAddon = () => {
    if (newAddonUrl && newAddonName) {
      onAddStremioAddon({ id: Date.now().toString(), name: newAddonName, url: newAddonUrl });
      setNewAddonUrl("");
      setNewAddonName("");
    }
  };

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>Stremio Integration</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <span className="text-[oklch(87%_0_0)]" style={{ fontWeight: 400 }}>Enable Stremio Add-ons</span>
            <input
              type="checkbox"
              checked={stremioEnabled}
              onChange={(e) => onToggleStremio(e.target.checked)}
              className="w-12 h-6 appearance-none bg-[oklch(43.9%_0_0)] rounded-full relative cursor-pointer transition-colors checked:bg-[oklch(48.8%_0.243_264.376)] before:content-[''] before:absolute before:w-5 before:h-5 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 before:transition-transform checked:before:translate-x-6"
            />
          </label>
        </div>

        {stremioEnabled && (
          <>
            <div className="bg-[oklch(26.9%_0_0)] rounded-lg p-6 mb-6">
              <h4 className="text-[oklch(98.5%_0_0)] mb-4" style={{ fontWeight: 500 }}>Add New Add-on</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Add-on Name"
                  value={newAddonName}
                  onChange={(e) => setNewAddonName(e.target.value)}
                  className="w-full px-4 py-3 bg-[oklch(20.5%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none"
                  style={{ fontWeight: 400 }}
                />
                <input
                  type="text"
                  placeholder="Add-on JSON URL"
                  value={newAddonUrl}
                  onChange={(e) => setNewAddonUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-[oklch(20.5%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(48.8%_0.243_264.376)] focus:outline-none"
                  style={{ fontWeight: 400 }}
                />
                <button
                  onClick={handleAddAddon}
                  className="w-full px-4 py-3 bg-[oklch(48.8%_0.243_264.376)] text-[oklch(98.5%_0_0)] rounded-lg hover:bg-[oklch(48.8%_0.243_264.376)]/80 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Add Add-on
                </button>
              </div>
            </div>

            <h4 className="text-[oklch(98.5%_0_0)] mb-4" style={{ fontWeight: 500 }}>Installed Add-ons</h4>
            <div className="space-y-3">
              {stremioAddons.map((addon) => (
                <div
                  key={addon.id}
                  className="flex items-center justify-between p-4 bg-[oklch(26.9%_0_0)] rounded-lg hover:bg-[oklch(43.9%_0_0)]/30 transition-colors"
                >
                  <div>
                    <div className="text-[oklch(98.5%_0_0)] mb-1" style={{ fontWeight: 400 }}>{addon.name}</div>
                    <div className="text-[oklch(70.8%_0_0)] text-sm" style={{ fontWeight: 400 }}>{addon.url}</div>
                  </div>
                  <button
                    onClick={() => onRemoveStremioAddon(addon.id)}
                    className="p-2 bg-[oklch(63.7%_0.237_25.331)]/20 text-[oklch(70.4%_0.191_22.216)] rounded-lg hover:bg-[oklch(63.7%_0.237_25.331)]/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {stremioAddons.length === 0 && (
                <div className="text-center text-[oklch(70.8%_0_0)] py-8" style={{ fontWeight: 400 }}>
                  No add-ons installed yet
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
