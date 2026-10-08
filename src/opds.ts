import { XMLParser } from "fast-xml-parser";
import { Book, BookFile } from "./book";

export interface FeedPage {
  books: Book[];
  next?: string;
}

interface Link {
  "@_rel"?: string;
  "@_href": string;
  "@_length"?: string;
}

interface Entry {
  title: string;
  updated: string;
  published?: string;
  author?: { name: string }[];
  category?: { "@_label": string }[];
  link?: Link[];
}

const ACQUISITION = "http://opds-spec.org/acquisition";
const DOWNLOAD_PATH = /\/opds\/download\/(\d+)\/([^/]+)\/?$/;
// Calibre stores an unknown publication date as 0101-01-01.
const UNDEFINED_YEAR = 101;

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  htmlEntities: true,
  isArray: (name) => ["entry", "link", "author", "category"].includes(name),
});

export function parseFeed(xml: string): FeedPage {
  const feed = parser.parse(xml).feed;
  const entries: Entry[] = feed.entry ?? [];
  const next = (feed.link as Link[] | undefined)?.find((link) => link["@_rel"] === "next")?.["@_href"];
  return { books: entries.flatMap(parseEntry), next };
}

function parseEntry(entry: Entry): Book[] {
  const files: (BookFile & { id: number })[] = (entry.link ?? []).flatMap((link) => {
    const match = link["@_rel"] === ACQUISITION ? DOWNLOAD_PATH.exec(link["@_href"]) : null;
    if (!match) return [];
    return [{ id: Number(match[1]), format: match[2], size: Number(link["@_length"] ?? 0), path: link["@_href"] }];
  });
  if (files.length === 0) return [];

  const year = entry.published ? Number(entry.published.slice(0, 4)) : undefined;
  return [
    {
      id: files[0].id,
      title: entry.title,
      authors: (entry.author ?? []).map((author) => author.name),
      tags: (entry.category ?? []).map((category) => category["@_label"]),
      year: year === UNDEFINED_YEAR ? undefined : year,
      updated: entry.updated,
      files: files.map(({ format, size, path }) => ({ format, size, path })),
    },
  ];
}
