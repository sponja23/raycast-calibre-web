import { describe, expect, it } from "vitest";
import { Book, filesByPreference, formatSize, languageName, preferredFile, readerFile } from "./book";

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

describe("formatSize", () => {
  it("uses the largest unit that keeps the number above one", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(6348530)).toBe("6.1 MB");
    expect(formatSize(3 * 1024 ** 3)).toBe("3.0 GB");
  });
});

describe("languageName", () => {
  it("names the ISO 639-2 codes calibre stores", () => {
    expect(languageName("eng")).toBe("English");
    expect(languageName("ger")).toBe("German");
  });

  it("falls back to the code when it is not a valid language tag", () => {
    expect(languageName("not a code")).toBe("not a code");
  });
});
