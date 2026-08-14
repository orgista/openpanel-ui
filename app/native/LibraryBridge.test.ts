import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
}

describe("LibraryBridge web fallback", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    vi.resetModules();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("starts without a hardcoded catalog or sample publication", async () => {
    const { LibraryBridge } = await import("./LibraryBridge");
    const { catalogs } = await LibraryBridge.listCatalogs();
    const { publications } = await LibraryBridge.listPublications();

    expect(catalogs).toEqual([]);
    expect(publications).toEqual([]);
  });

  it("rejects insecure catalogs and accepts an institutional HTTPS feed", async () => {
    const { LibraryBridge } = await import("./LibraryBridge");

    await expect(LibraryBridge.addCatalog({ url: "http://library.example/opds" })).rejects.toThrow("HTTPS");
    const { catalog } = await LibraryBridge.addCatalog({
      title: "City Library",
      url: "https://library.example/opds",
    });

    expect(catalog.title).toBe("City Library");
    expect((await LibraryBridge.listCatalogs()).catalogs).toContainEqual(catalog);
  });

  it("downloads, opens, and removes a publication", async () => {
    const { LibraryBridge } = await import("./LibraryBridge");
    const { publication } = await LibraryBridge.downloadPublication({
      url: "https://library.example/book.epub",
      title: "Library Book",
      authors: ["Public Author"],
      mediaType: "application/epub+zip",
    });

    expect(publication.local).toBe(true);
    await LibraryBridge.openPublication({ id: publication.id });
    expect((await LibraryBridge.listPublications()).publications.find((item) => item.id === publication.id)?.lastOpenedAt).toEqual(expect.any(Number));
    expect(await LibraryBridge.removePublication({ id: publication.id })).toEqual({ removed: true });
  });
});
