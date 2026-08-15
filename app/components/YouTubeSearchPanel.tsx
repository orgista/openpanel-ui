import { useMemo, useRef, useState } from "react";
import { Check, Loader2, Mic, Plus, Search, Youtube } from "lucide-react";

import type { KioskYouTubeItem } from "../native/youtube";
import { dismissSoftKeyboard } from "../native/keyboard";
import {
  SystemBridge,
  type DeviceProfile,
  type YouTubeChannelResult,
} from "../native/SystemBridge";

interface YouTubeSearchPanelProps {
  approvedItems: KioskYouTubeItem[];
  deviceProfile?: DeviceProfile | null;
  onAdd: (url: string, title: string, thumbnailUrl?: string | null) => boolean;
}

const readableError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/rate|limit|429/i.test(message)) {
    return "YouTube is temporarily limiting verification. Try again shortly.";
  }
  if (/network|connect|timeout/i.test(message)) {
    return "OpenPanel could not reach YouTube. Check this device's network.";
  }
  if (/not found|not be verified|exact channel/i.test(message)) {
    return "That exact channel could not be verified. Try its unique @handle.";
  }
  return message || "OpenPanel could not verify that YouTube channel.";
};

export function YouTubeSearchPanel({ approvedItems, deviceProfile, onAdd }: YouTubeSearchPanelProps) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<YouTubeChannelResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const approvedIds = useMemo(
    () => new Set(approvedItems.map((item) => item.sourceLabel)),
    [approvedItems],
  );

  const resolveChannel = async (nextInput = input) => {
    const normalized = nextInput.trim();
    if (normalized.length < 2) {
      setError("Enter a channel name or its unique @handle.");
      return;
    }
    await dismissSoftKeyboard();
    setResolving(true);
    setError(null);
    setResult(null);
    try {
      const response = await SystemBridge.resolveYouTubeChannel({ input: normalized });
      setResult(response.channel);
    } catch (resolutionError) {
      setError(readableError(resolutionError));
    } finally {
      setResolving(false);
    }
  };

  const useRemoteMicrophone = () => {
    inputRef.current?.focus();
    setError("Select the channel box and press your remote's microphone button to dictate.");
  };

  const resolveByVoice = async () => {
    if (deviceProfile?.remoteUi && deviceProfile.voiceInputAvailable === false) {
      useRemoteMicrophone();
      return;
    }
    setListening(true);
    setError(null);
    try {
      const { text } = await SystemBridge.requestVoiceInput({
        prompt: "Say the exact YouTube channel name or handle",
      });
      const spokenInput = text.trim();
      if (!spokenInput) return;
      setInput(spokenInput);
      await resolveChannel(spokenInput);
    } catch (voiceError) {
      if (deviceProfile?.remoteUi) useRemoteMicrophone();
      else setError(readableError(voiceError));
    } finally {
      setListening(false);
    }
  };

  const addResult = () => {
    if (!result) return;
    if (!onAdd(result.sourceUrl, result.title, result.thumbnailUrl)) {
      setError(`OpenPanel could not add “${result.title}”.`);
      return;
    }
    setAddedIds((current) => new Set(current).add(result.sourceId));
    setError(null);
  };

  const added = result
    ? approvedIds.has(result.sourceId) || addedIds.has(result.sourceId)
    : false;

  return (
    <section className="youtube-search-panel bg-[oklch(26.9%_0_0)] rounded-xl p-4 sm:p-5 mb-6 border border-[oklch(34%_0_0)]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 text-[oklch(98.5%_0_0)]" style={{ fontWeight: 600 }}>
            <Search className="w-5 h-5 text-[oklch(68%_0.19_264)]" />
            Add a YouTube channel
          </div>
          <p className="text-[oklch(65%_0_0)] text-sm mt-1">
            Enter a channel name, @handle, channel ID, or URL. OpenPanel finds the channel and checks it before adding.
          </p>
        </div>
      </div>

      <div className="youtube-search-controls flex min-w-0 gap-2">
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setResult(null);
            setError(null);
          }}
          onKeyDown={(event) => { if (event.key === "Enter") resolveChannel(); }}
          placeholder="Google Developers or @GoogleDevelopers"
          aria-label="YouTube channel name or handle"
          aria-describedby={deviceProfile?.remoteUi ? "youtube-remote-mic-hint" : "youtube-channel-hint"}
          className="min-w-0 flex-1 px-4 py-3 bg-[oklch(16%_0_0)] text-[oklch(98.5%_0_0)] rounded-lg border border-[oklch(43.9%_0_0)] focus:border-[oklch(58%_0.22_264)] focus:outline-none placeholder:text-[oklch(48%_0_0)]"
        />
        <button
          type="button"
          onClick={resolveByVoice}
          disabled={listening || (deviceProfile?.voiceInputAvailable === false && !deviceProfile.remoteUi)}
          aria-label="Enter channel by voice"
          title={deviceProfile?.remoteUi ? "Use the microphone button on your remote" : "Enter channel by voice"}
          className="shrink-0 size-12 inline-flex items-center justify-center rounded-lg bg-[oklch(36%_0.12_264)] text-white hover:bg-[oklch(44%_0.16_264)] disabled:opacity-40 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
        >
          {listening ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
        </button>
        <button
          type="button"
          onClick={() => resolveChannel()}
          disabled={resolving}
          className="shrink-0 px-4 sm:px-5 py-3 rounded-lg bg-[oklch(48.8%_0.243_264.376)] text-white disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
        >
          {resolving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify channel"}
        </button>
      </div>

      <p id="youtube-channel-hint" className="mt-2 text-xs text-[oklch(58%_0_0)]">
        If a channel name doesn't match, enter its @handle instead.
      </p>
      {deviceProfile?.remoteUi && (
        <p id="youtube-remote-mic-hint" className="mt-2 text-xs text-[oklch(62%_0_0)]">
          Select the channel box and press your remote's microphone button to dictate.
        </p>
      )}

      {result && (
        <article className="flex gap-3 items-center rounded-lg p-3 bg-[oklch(18%_0_0)] border border-[oklch(38%_0_0)] mt-5" aria-label="Verified YouTube channel">
          {result.thumbnailUrl ? (
            <img src={result.thumbnailUrl} alt="" className="w-20 h-20 object-cover rounded-lg shrink-0 bg-black" draggable={false} />
          ) : (
            <div className="w-20 h-20 rounded-lg shrink-0 bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center">
              <Youtube className="w-7 h-7 text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 text-[oklch(78%_0.13_142)] text-xs mb-1">
              <Check className="w-3.5 h-3.5" /> Verified exact channel
            </div>
            <div className="text-[oklch(94%_0_0)] line-clamp-2" style={{ fontWeight: 500 }}>{result.title}</div>
            <div className="text-[oklch(58%_0_0)] text-xs truncate mt-1">{result.sourceUrl}</div>
          </div>
          <button
            type="button"
            disabled={added}
            onClick={addResult}
            aria-label={added ? `${result.title} added` : `Add ${result.title}`}
            className={`shrink-0 min-w-20 px-3 py-2.5 rounded-lg inline-flex justify-center items-center gap-1.5 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80 ${
              added
                ? "bg-[oklch(32%_0.09_142)] text-[oklch(82%_0.14_142)]"
                : "bg-[oklch(48.8%_0.243_264.376)] text-white hover:opacity-90"
            }`}
          >
            {added ? <><Check className="w-4 h-4" /> Added</> : <><Plus className="w-4 h-4" /> Add</>}
          </button>
        </article>
      )}

      {error && <p role="alert" className="mt-3 text-[oklch(72%_0.18_22)] text-sm">{error}</p>}
    </section>
  );
}
