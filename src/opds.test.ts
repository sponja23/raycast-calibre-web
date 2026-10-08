import { describe, expect, it } from "vitest";
import { fixture } from "./__fixtures__/fixture";
import { parseFeed } from "./opds";

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

  it("parses a page recorded from the live server", () => {
    const { books, next } = parseFeed(fixture("recorded-new-page.xml"));

    expect(next).toBe("/opds/new?offset=60");
    expect(books[0]).toEqual({
      id: 659,
      title: "xUnit Test Patterns: Refactoring Test Code",
      authors: ["Gerard Meszaros"],
      tags: ["Programming", "Software Engineering"],
      year: 2007,
      updated: "2026-10-08T06:35:57+00:00",
      files: [{ format: "pdf", size: 6348530, path: "/opds/download/659/pdf/" }],
    });
    expect(books.map((book) => book.id)).toEqual([659, 658, 656]);
  });
});
