import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFeed } from "./opds";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");

describe("parseFeed", () => {
  it("reads every book field from an entry", () => {
    const { books } = parseFeed(fixture("new-page-1.xml"));

    expect(books[0]).toEqual({
      id: 412,
      title: "Categories for the Working Mathematician",
      authors: ["Saunders Mac Lane"],
      tags: ["Category Theory", "Mathematics"],
      year: 1998,
      updated: "2026-09-30T18:04:11+00:00",
      files: [
        { format: "epub", size: 1048576, path: "/opds/download/412/epub/" },
        { format: "pdf", size: 15728640, path: "/opds/download/412/pdf/" },
      ],
    });
  });

  it("handles several authors, no tags, escaped titles and calibre's undefined date", () => {
    const { books } = parseFeed(fixture("new-page-1.xml"));

    expect(books[1]).toMatchObject({
      id: 7,
      title: "Structure & Interpretation of Computer Programs",
      authors: ["Harold Abelson", "Gerald Jay Sussman"],
      tags: [],
      year: undefined,
    });
  });

  it("keeps numeric titles as text and decodes character references", () => {
    const { books } = parseFeed(fixture("new-page-1.xml"));

    expect(books[2]).toMatchObject({ title: "1984", tags: ["Orwell's Novels"] });
  });

  it("returns the next page link while there is one", () => {
    expect(parseFeed(fixture("new-page-1.xml")).next).toBe("/opds/new?offset=2");
    expect(parseFeed(fixture("new-page-2.xml")).next).toBeUndefined();
  });

  it("parses a feed with a single entry", () => {
    expect(parseFeed(fixture("new-page-2.xml")).books.map((book) => book.title)).toEqual(["Gödel, Escher, Bach"]);
  });
});
