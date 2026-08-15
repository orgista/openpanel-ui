import { useCallback, useEffect, useState } from "react";
import { BookOpen, ExternalLink, Headphones, Library, Loader2, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import {
  formatLibraryAuthors,
  LibraryBridge,
  type LibraryCatalog,
  type LibraryPublication,
} from "../native/LibraryBridge";
import { dismissSoftKeyboard } from "../native/keyboard";

interface LibraryManagerProps {
  onLibraryChanged?: () => void;
}

function readableBytes(bytes: number): string {
  if (bytes <= 0) return "Stored offline";
  if (bytes < 1_048_576) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function LibraryManager({ onLibraryChanged }: LibraryManagerProps) {
  const [publications, setPublications] = useState<LibraryPublication[]>([]);
  const [catalogs, setCatalogs] = useState<LibraryCatalog[]>([]);
  const [catalogTitle, setCatalogTitle] = useState("");
  const [catalogUrl, setCatalogUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [publicationResult, catalogResult] = await Promise.all([
      LibraryBridge.listPublications(),
      LibraryBridge.listCatalogs(),
    ]);
    setPublications(publicationResult.publications);
    setCatalogs(catalogResult.catalogs);
  }, []);

  useEffect(() => {
    void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load the library."));
  }, [refresh]);

  const importBook = useCallback(async () => {
    setBusy("import");
    setMessage(null);
    try {
      const { publication } = await LibraryBridge.importPublication();
      setMessage(`${publication.title} is ready offline.`);
      await refresh();
      onLibraryChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The selected publication could not be imported.");
    } finally {
      setBusy(null);
    }
  }, [onLibraryChanged, refresh]);

  const addCatalog = useCallback(async () => {
    await dismissSoftKeyboard();
    if (!catalogUrl.trim()) {
      setMessage("Enter an OPDS catalog URL.");
      return;
    }
    setBusy("catalog");
    setMessage(null);
    try {
      const { catalog } = await LibraryBridge.addCatalog({
        title: catalogTitle.trim() || undefined,
        url: catalogUrl.trim(),
      });
      setCatalogTitle("");
      setCatalogUrl("");
      setMessage(`${catalog.title} was added.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That OPDS catalog could not be added.");
    } finally {
      setBusy(null);
    }
  }, [catalogTitle, catalogUrl, refresh]);

  const removePublication = useCallback(async (publication: LibraryPublication) => {
    setBusy(publication.id);
    setMessage(null);
    try {
      await LibraryBridge.removePublication({ id: publication.id });
      setMessage(`${publication.title} was removed from this device.`);
      await refresh();
      onLibraryChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The publication could not be removed.");
    } finally {
      setBusy(null);
    }
  }, [onLibraryChanged, refresh]);

  const removeCatalog = useCallback(async (catalog: LibraryCatalog) => {
    setBusy(catalog.id);
    try {
      await LibraryBridge.removeCatalog({ id: catalog.id });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The catalog could not be removed.");
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-7">
        <div>
          <h3 className="text-xl text-[oklch(98.5%_0_0)] mb-2" style={{ fontWeight: 500 }}>Books &amp; Audio</h3>
          <p className="text-[oklch(70.8%_0_0)] text-sm max-w-3xl">
            Import EPUB, PDF, Readium audiobook, MP3, or AAC files and connect standards-based OPDS 1/2 catalogs used by libraries and public institutions. Downloads stay in OpenPanel's private offline storage.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void importBook()}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[oklch(48.8%_0.243_264.376)] text-white px-5 py-3 disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
        >
          {busy === "import" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Import file
        </button>
      </div>

      {message && (
        <p role="status" className="mb-5 rounded-lg border border-[oklch(43.9%_0_0)] bg-[oklch(26.9%_0_0)] px-4 py-3 text-sm text-[oklch(87%_0_0)]">
          {message}
        </p>
      )}

      <section className="mb-8" aria-labelledby="catalog-heading">
        <h4 id="catalog-heading" className="text-lg text-[oklch(98.5%_0_0)] mb-3" style={{ fontWeight: 500 }}>Institutional catalogs</h4>
        <div className="rounded-lg bg-[oklch(26.9%_0_0)] p-4 sm:p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(10rem,0.65fr)_minmax(16rem,1.35fr)_auto] gap-3">
            <input
              value={catalogTitle}
              onChange={(event) => setCatalogTitle(event.target.value)}
              placeholder="Catalog name (optional)"
              autoComplete="off"
              className="rounded-lg bg-[oklch(20.5%_0_0)] border border-[oklch(43.9%_0_0)] px-4 py-2.5 text-[oklch(98.5%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
            />
            <input
              value={catalogUrl}
              onChange={(event) => setCatalogUrl(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void addCatalog(); }}
              inputMode="url"
              autoComplete="off"
              placeholder="https://library.example.org/opds"
              className="rounded-lg bg-[oklch(20.5%_0_0)] border border-[oklch(43.9%_0_0)] px-4 py-2.5 text-[oklch(98.5%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
            />
            <button
              type="button"
              onClick={() => void addCatalog()}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[oklch(36%_0_0)] text-white px-5 py-2.5 disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
            >
              {busy === "catalog" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add OPDS
            </button>
          </div>
          <p className="text-xs text-[oklch(60%_0_0)] mt-3">
            HTTPS is required. Credentials are not stored in this release. Licensed Palace, Libby, Hoopla, cloudLibrary, or LCP collections require the institution's approved sign-in connector.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {catalogs.map((catalog) => (
            <div key={catalog.id} className="flex items-center gap-3 rounded-lg border border-[oklch(36%_0_0)] bg-[oklch(24%_0_0)] p-4">
              <Library className="size-7 shrink-0 text-[oklch(70%_0.08_264)]" />
              <div className="min-w-0 flex-1">
                <div className="text-[oklch(94%_0_0)] truncate" style={{ fontWeight: 500 }}>{catalog.title}</div>
                <div className="text-xs text-[oklch(60%_0_0)] truncate">{catalog.url}</div>
              </div>
              {catalog.builtIn ? (
                <span className="text-xs rounded-full bg-[oklch(36%_0.08_150)] px-2.5 py-1 text-[oklch(85%_0.08_150)]">Open access</span>
              ) : (
                <button type="button" onClick={() => void removeCatalog(catalog)} disabled={busy !== null} aria-label={`Remove ${catalog.title}`} className="p-2 rounded-lg text-[oklch(72%_0.18_22)] hover:bg-white/5 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80">
                  {busy === catalog.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="offline-heading">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h4 id="offline-heading" className="text-lg text-[oklch(98.5%_0_0)]" style={{ fontWeight: 500 }}>Offline on this device ({publications.length})</h4>
          <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[oklch(75%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80">
            <RefreshCw className="size-4" /> Refresh
          </button>
        </div>
        {publications.length === 0 ? (
          <div tabIndex={0} role="status" className="rounded-lg border border-dashed border-[oklch(43.9%_0_0)] px-6 py-10 text-center text-[oklch(65%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80">
            <BookOpen className="size-9 mx-auto mb-3 opacity-70" />
            No offline books or audiobooks yet. Import a file or download one from an OPDS catalog.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {publications.map((publication) => (
              <div key={publication.id} className="flex items-center gap-4 rounded-lg bg-[oklch(26.9%_0_0)] p-4">
                <div className="size-12 rounded-lg bg-[oklch(34%_0.05_264)] flex items-center justify-center shrink-0">
                  {publication.format === "audiobook" || publication.format === "audio"
                    ? <Headphones className="size-6 text-white" />
                    : <BookOpen className="size-6 text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[oklch(95%_0_0)] truncate" style={{ fontWeight: 500 }}>{publication.title}</div>
                  <div className="text-xs text-[oklch(62%_0_0)] truncate">{formatLibraryAuthors(publication.authors)} · {publication.format.toUpperCase()} · {readableBytes(publication.bytes)}</div>
                </div>
                <button type="button" onClick={() => void LibraryBridge.openPublication({ id: publication.id })} aria-label={`Open ${publication.title}`} className="p-2 rounded-lg text-[oklch(78%_0.08_264)] hover:bg-white/5 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80">
                  <ExternalLink className="size-4" />
                </button>
                <button type="button" onClick={() => void removePublication(publication)} disabled={busy !== null} aria-label={`Remove ${publication.title}`} className="p-2 rounded-lg text-[oklch(72%_0.18_22)] hover:bg-white/5 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80">
                  {busy === publication.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
