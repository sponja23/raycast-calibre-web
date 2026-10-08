import { describe, expect, it } from "vitest";
import { Book, preferredFile } from "./book";

const book = (...formats: string[]): Book => ({
  id: 1,
  title: "A Book",
  authors: [],
  tags: [],
  updated: "2026-01-01T00:00:00+00:00",
  files: formats.map((format) => ({ format, size: 1, path: `/opds/download/1/${format}/` })),
});

describe("preferredFile", () => {
  it("prefers PDF, then EPUB, DjVu and MOBI", () => {
    expect(preferredFile(book("mobi", "epub", "pdf"))?.format).toBe("pdf");
    expect(preferredFile(book("mobi", "djvu", "epub"))?.format).toBe("epub");
    expect(preferredFile(book("mobi", "djvu"))?.format).toBe("djvu");
  });

  it("falls back to the first file in a format outside the preference list", () => {
    expect(preferredFile(book("azw3", "cbz"))?.format).toBe("azw3");
    expect(preferredFile(book("cbz", "mobi"))?.format).toBe("mobi");
  });
});
