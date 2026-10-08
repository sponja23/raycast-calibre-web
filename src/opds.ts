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
  publisher?: { name: string };
  "dcterms:language"?: string[];
  summary?: string;
  category?: { "@_label": string }[];
  link?: Link[];
}

const ACQUISITION = "http://opds-spec.org/acquisition";
const DOWNLOAD_PATH = /\/opds\/download\/(\d+)\/([^/]+)\/?$/;
// Calibre stores an unknown publication date as year 101, which the server renders without zero padding.
const UNDEFINED_YEAR = 101;
const YEAR = /^(\d+)-/;
const UNDETERMINED_LANGUAGE = "und";

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  htmlEntities: true,
  isArray: (name) => ["entry", "link", "author", "category", "dcterms:language"].includes(name),
});

export class InvalidFeedError extends Error {
  constructor() {
    super("The response is not an OPDS feed");
    this.name = "InvalidFeedError";
  }
}

export function parseFeed(xml: string): FeedPage {
  const feed = parser.parse(xml).feed;
  if (!feed) throw new InvalidFeedError();
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

  const yearMatch = entry.published ? YEAR.exec(entry.published) : null;
  const year = yearMatch ? Number(yearMatch[1]) : undefined;
  return [
    {
      id: files[0].id,
      title: entry.title,
      authors: (entry.author ?? []).map((author) => author.name),
      tags: (entry.category ?? []).map((category) => category["@_label"]),
      year: year === UNDEFINED_YEAR ? undefined : year,
      publisher: entry.publisher?.name,
      languages: (entry["dcterms:language"] ?? []).filter((code) => code !== UNDETERMINED_LANGUAGE),
      summary: entry.summary,
      updated: entry.updated,
      files: files.map(({ format, size, path }) => ({ format, size, path })),
    },
  ];
}
