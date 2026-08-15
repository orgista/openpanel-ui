import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Download, Headphones, Library, Loader2, X } from "lucide-react";
import {
  formatLibraryAuthors,
  LibraryBridge,
  type CatalogEntry,
  type CatalogPage,
  type LibraryCatalog,
} from "../native/LibraryBridge";

interface LibraryCatalogBrowserProps {
  onClose: () => void;
  onLibraryChanged: () => void;
}

export function LibraryCatalogBrowser({ onClose, onLibraryChanged }: LibraryCatalogBrowserProps) {
  const [catalogs, setCatalogs] = useState<LibraryCatalog[]>([]);
  const [page, setPage] = useState<CatalogPage | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void LibraryBridge.listCatalogs()
      .then(({ catalogs: next }) => setCatalogs(next))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load catalogs."));
  }, []);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      // Clear history when leaving a catalog for the list, so Back on a freshly
      // opened catalog can't fetch the previous catalog's stale pages.
      if (page) { setPage(null); setHistory([]); } else onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose, page]);

  const fetchPage = useCallback(async (url: string, remember = true) => {
    setLoading(true);
    setMessage(null);
    try {
      if (remember && page) setHistory((items) => [...items, page.url]);
      setPage(await LibraryBridge.fetchCatalog({ url }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That catalog could not be read.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  const goBack = useCallback(() => {
    const previous = history[history.length - 1];
    if (!previous) {
      // Back from a catalog's first page returns to the list — clear history so
      // a later catalog can't Back into this one's pages.
      setPage(null);
      setHistory([]);
      return;
    }
    setHistory((items) => items.slice(0, -1));
    void fetchPage(previous, false);
  }, [fetchPage, history]);

  const download = useCallback(async (entry: CatalogEntry) => {
    if (!entry.acquisitionUrl || entry.acquisitionType === "borrow" || entry.acquisitionType === "buy") {
      setMessage("This item requires the library's authorized lending or sign-in connector.");
      return;
    }
    setDownloading(entry.id);
    setMessage(null);
    try {
      await LibraryBridge.downloadPublication({
        url: entry.acquisitionUrl,
        title: entry.title,
        authors: entry.authors,
        coverUrl: entry.coverUrl,
        mediaType: entry.mediaType,
      });
      setMessage(`${entry.title} is ready offline.`);
      onLibraryChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The publication could not be downloaded.");
    } finally {
      setDownloading(null);
    }
  }, [onLibraryChanged]);

  return (
    <div data-dpad-scope className="fixed inset-0 z-[120] bg-[oklch(11%_0_0)] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Library catalogs">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[oklch(14%_0_0)]/95 backdrop-blur px-5 sm:px-8 py-4">
        {page ? (
          <button type="button" onClick={goBack} aria-label="Back to catalogs" className="p-3 rounded-xl bg-white/5 text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80">
            <ArrowLeft className="size-5" />
          </button>
        ) : (
          <Library className="size-7 text-[oklch(75%_0.12_264)]" />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl text-white truncate" style={{ fontWeight: 600 }}>{page?.title ?? "Library catalogs"}</h2>
          <p className="text-xs sm:text-sm text-[oklch(65%_0_0)] truncate">{page?.url ?? "Browse and save books or audiobooks for offline use"}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close library" className="p-3 rounded-xl bg-white/5 text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80">
          <X className="size-5" />
        </button>
      </header>

      <main className="px-5 sm:px-8 py-7 max-w-7xl mx-auto">
        {message && <p role="status" className="mb-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[oklch(88%_0_0)]">{message}</p>}
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-[oklch(70%_0_0)]"><Loader2 className="size-6 animate-spin" /> Reading catalog…</div>
        ) : !page ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalogs.map((catalog) => (
              <button
                type="button"
                key={catalog.id}
                onClick={() => void fetchPage(catalog.url)}
                className="min-h-36 rounded-2xl border border-white/10 bg-[oklch(20.5%_0_0)] p-6 text-left hover:bg-[oklch(25%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
              >
                <Library className="size-8 text-[oklch(72%_0.12_264)] mb-4" />
                <div className="text-lg text-white mb-1" style={{ fontWeight: 600 }}>{catalog.title}</div>
                <div className="text-xs text-[oklch(60%_0_0)] break-all">{catalog.url}</div>
              </button>
            ))}
            {catalogs.length === 0 && (
              <div tabIndex={0} className="col-span-full rounded-2xl border border-dashed border-white/20 py-16 px-6 text-center text-[oklch(65%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80">
                Ask an administrator to add an OPDS catalog in Admin Panel → Books &amp; Audio.
              </div>
            )}
          </div>
        ) : (
          <>
            {page.navigation.length > 0 && (
              <section className="mb-8" aria-label="Catalog sections">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {page.navigation.map((link) => (
                    <button key={`${link.rel}:${link.url}`} type="button" onClick={() => void fetchPage(link.url)} className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-left text-white hover:bg-white/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80">
                      {link.title}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <section aria-label="Catalog publications" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {page.entries.map((entry) => {
                const audio = entry.format === "audiobook" || entry.format === "audio";
                // "buy" entries can't be saved offline either (download() rejects
                // them), so treat them like "borrow": show the sign-in prompt
                // rather than a misleading "Save offline" button that errors.
                const licensed = entry.acquisitionType === "borrow"
                  || entry.acquisitionType === "buy"
                  || !entry.acquisitionUrl;
                return (
                  <article key={entry.id} className="rounded-2xl border border-white/10 bg-[oklch(20.5%_0_0)] overflow-hidden" style={{ contentVisibility: "auto", containIntrinsicSize: "220px" }}>
                    <div className="flex gap-4 p-5">
                      {entry.coverUrl ? (
                        <img src={entry.coverUrl} alt="" loading="lazy" className="w-24 h-36 object-cover rounded-lg bg-white/5 shrink-0" />
                      ) : (
                        <div className="w-24 h-36 rounded-lg bg-[oklch(31%_0.08_264)] flex items-center justify-center shrink-0">
                          {audio ? <Headphones className="size-8 text-white" /> : <BookOpen className="size-8 text-white" />}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg text-white line-clamp-3" style={{ fontWeight: 600 }}>{entry.title}</h3>
                        <p className="text-sm text-[oklch(68%_0_0)] mt-1 line-clamp-2">{formatLibraryAuthors(entry.authors)}</p>
                        <p className="text-xs uppercase tracking-wide text-[oklch(66%_0.08_264)] mt-3">{entry.format ?? "Publication"}</p>
                      </div>
                    </div>
                    {entry.summary && <p className="px-5 pb-4 text-sm text-[oklch(65%_0_0)] line-clamp-3">{entry.summary}</p>}
                    <button
                      type="button"
                      onClick={() => void download(entry)}
                      disabled={downloading !== null}
                      className="w-full flex items-center justify-center gap-2 border-t border-white/10 px-5 py-4 text-white bg-white/5 hover:bg-white/10 disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white/80"
                    >
                      {downloading === entry.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                      {licensed ? "Library sign-in required" : "Save offline"}
                    </button>
                  </article>
                );
              })}
            </section>
            {page.entries.length === 0 && page.navigation.length === 0 && (
              <div tabIndex={0} className="rounded-2xl border border-dashed border-white/20 py-16 px-6 text-center text-[oklch(65%_0_0)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80">This catalog page has no compatible publications.</div>
            )}
            {page.nextUrl && (
              <button type="button" onClick={() => void fetchPage(page.nextUrl!)} className="mt-8 w-full rounded-xl bg-white/5 px-5 py-4 text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80">Load more</button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
