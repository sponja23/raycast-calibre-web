import { describe, expect, it } from "vitest";
import { Book, filesByPreference, preferredFile, readerFile } from "./book";

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

describe("readerFile", () => {
  it("picks the preferred format the web reader can show", () => {
    expect(readerFile(book("mobi", "epub", "pdf"))?.format).toBe("pdf");
    expect(readerFile(book("mobi", "djvu"))?.format).toBe("djvu");
  });

  it("has nothing for books only in formats the web reader cannot show", () => {
    expect(readerFile(book("mobi"))).toBeUndefined();
    expect(readerFile(book("azw3", "mobi"))).toBeUndefined();
  });
});

describe("filesByPreference", () => {
  it("lists the preferred file first and keeps the rest in preference order", () => {
    expect(filesByPreference(book("azw3", "mobi", "pdf", "epub")).map((file) => file.format)).toEqual([
      "pdf",
      "epub",
      "mobi",
      "azw3",
    ]);
  });
});
