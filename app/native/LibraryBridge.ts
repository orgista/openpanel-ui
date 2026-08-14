import { Capacitor, registerPlugin } from "@capacitor/core";

export type LibraryFormat = "epub" | "pdf" | "audiobook" | "audio";

export interface LibraryPublication {
  id: string;
  title: string;
  authors: string[];
  narrator?: string | null;
  format: LibraryFormat;
  mediaType: string;
  coverUrl?: string | null;
  sourceUrl?: string | null;
  local: boolean;
  bytes: number;
  addedAt: number;
  lastOpenedAt?: number | null;
  progression?: number | null;
}

export interface LibraryCatalog {
  id: string;
  title: string;
  url: string;
  builtIn: boolean;
}

export interface CatalogEntry {
  id: string;
  title: string;
  authors: string[];
  summary?: string | null;
  coverUrl?: string | null;
  acquisitionUrl?: string | null;
  mediaType?: string | null;
  format?: LibraryFormat | null;
  acquisitionType?: "download" | "borrow" | "buy" | "open-access" | "unknown";
}

export interface CatalogLink {
  title: string;
  url: string;
  rel: string;
}

export interface CatalogPage {
  title: string;
  url: string;
  entries: CatalogEntry[];
  navigation: CatalogLink[];
  nextUrl?: string | null;
}

interface LibraryBridgePlugin {
  listPublications(): Promise<{ publications: LibraryPublication[] }>;
  importPublication(): Promise<{ publication: LibraryPublication }>;
  downloadPublication(options: {
    url: string;
    title: string;
    authors?: string[];
    coverUrl?: string | null;
    mediaType?: string | null;
  }): Promise<{ publication: LibraryPublication }>;
  openPublication(options: { id: string }): Promise<void>;
  removePublication(options: { id: string }): Promise<{ removed: boolean }>;
  listCatalogs(): Promise<{ catalogs: LibraryCatalog[] }>;
  addCatalog(options: { title?: string; url: string }): Promise<{ catalog: LibraryCatalog }>;
  removeCatalog(options: { id: string }): Promise<{ removed: boolean }>;
  fetchCatalog(options: { url: string }): Promise<CatalogPage>;
}

const native = registerPlugin<LibraryBridgePlugin>("LibraryBridge");
const STORAGE_KEY = "openpanel.library.web.publications.v1";
const CATALOG_KEY = "openpanel.library.web.catalogs.v1";

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function saveStored(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

let webPublications = readStored<LibraryPublication[]>(STORAGE_KEY, []);
let webCatalogs = readStored<LibraryCatalog[]>(CATALOG_KEY, []);

const webMock: LibraryBridgePlugin = {
  async listPublications() {
    return { publications: [...webPublications] };
  },
  async importPublication() {
    const publication: LibraryPublication = {
      id: `web-import-${Date.now()}`,
      title: "Imported sample book",
      authors: ["Local author"],
      format: "epub",
      mediaType: "application/epub+zip",
      local: true,
      bytes: 248_000,
      addedAt: Date.now(),
      progression: 0,
    };
    webPublications = [publication, ...webPublications];
    saveStored(STORAGE_KEY, webPublications);
    return { publication };
  },
  async downloadPublication(options) {
    const format: LibraryFormat = options.mediaType?.includes("pdf")
      ? "pdf"
      : options.mediaType?.includes("audio")
        ? "audiobook"
        : "epub";
    const publication: LibraryPublication = {
      id: `web-download-${Date.now()}`,
      title: options.title,
      authors: options.authors ?? [],
      format,
      mediaType: options.mediaType ?? "application/epub+zip",
      coverUrl: options.coverUrl,
      sourceUrl: options.url,
      local: true,
      bytes: 512_000,
      addedAt: Date.now(),
      progression: 0,
    };
    webPublications = [publication, ...webPublications];
    saveStored(STORAGE_KEY, webPublications);
    return { publication };
  },
  async openPublication({ id }) {
    webPublications = webPublications.map((publication) => publication.id === id
      ? { ...publication, lastOpenedAt: Date.now(), progression: publication.progression ?? 0 }
      : publication);
    saveStored(STORAGE_KEY, webPublications);
  },
  async removePublication({ id }) {
    const before = webPublications.length;
    webPublications = webPublications.filter((publication) => publication.id !== id);
    saveStored(STORAGE_KEY, webPublications);
    return { removed: webPublications.length !== before };
  },
  async listCatalogs() {
    return { catalogs: [...webCatalogs] };
  },
  async addCatalog({ title, url }) {
    const normalized = new URL(url);
    if (normalized.protocol !== "https:") throw new Error("Catalogs must use HTTPS.");
    const catalog: LibraryCatalog = {
      id: `catalog-${Date.now()}`,
      title: title?.trim() || normalized.hostname,
      url: normalized.toString(),
      builtIn: false,
    };
    webCatalogs = [...webCatalogs.filter((item) => item.url !== catalog.url), catalog];
    saveStored(CATALOG_KEY, webCatalogs);
    return { catalog };
  },
  async removeCatalog({ id }) {
    const before = webCatalogs.length;
    webCatalogs = webCatalogs.filter((catalog) => catalog.id !== id);
    saveStored(CATALOG_KEY, webCatalogs);
    return { removed: webCatalogs.length !== before };
  },
  async fetchCatalog({ url }) {
    const catalogUrl = new URL(url);
    return {
      title: catalogUrl.hostname,
      url,
      entries: [],
      navigation: [],
      nextUrl: null,
    };
  },
};

export const LibraryBridge: LibraryBridgePlugin = Capacitor.isNativePlatform() ? native : webMock;

export function libraryPublicationById(
  publications: LibraryPublication[],
  id: string,
): LibraryPublication | undefined {
  return publications.find((publication) => publication.id === id);
}

export function formatLibraryAuthors(authors: string[]): string {
  return authors.length > 0 ? authors.join(", ") : "Unknown author";
}
