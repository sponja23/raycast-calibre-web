import { describe, expect, it } from "vitest";
import { escapeMarkdown, formatSize, languageNames } from "./format";

describe("formatSize", () => {
  it("uses the largest unit that keeps the number above one", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(6348530)).toBe("6.1 MB");
    expect(formatSize(3 * 1024 ** 3)).toBe("3.0 GB");
  });
});

describe("languageNames", () => {
  it("names the ISO 639-2 codes calibre stores", () => {
    expect(languageNames(["eng", "ger"])).toBe("English, German");
  });

  it("falls back to the code when it is not a valid language tag", () => {
    expect(languageNames(["not a code"])).toBe("not a code");
  });
});

describe("escapeMarkdown", () => {
  it("escapes characters markdown would otherwise format", () => {
    expect(escapeMarkdown("*NIX Tools_ #1 [draft]")).toBe("\\*NIX Tools\\_ \\#1 \\[draft\\]");
  });

  it("leaves plain text alone", () => {
    expect(escapeMarkdown("Gödel, Escher, Bach")).toBe("Gödel, Escher, Bach");
  });
});
