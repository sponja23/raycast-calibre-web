import { Book } from "./book";
import { InvalidFeedError, parseFeed } from "./opds";

export interface CalibreWebConfig {
  url: string;
  username: string;
  password: string;
}

export interface CalibreWebClient {
  fetchCatalog(): Promise<Book[]>;
  download(path: string, signal?: AbortSignal): Promise<Response>;
  readerUrl(id: number, format: string): string;
  bookUrl(id: number): string;
}

export class AuthError extends Error {
  constructor() {
    super("The server rejected the username or password");
    this.name = "AuthError";
  }
}

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("Could not reach the server", { cause });
    this.name = "NetworkError";
  }
}

export class ServerError extends Error {
  constructor(readonly status: number) {
    super(`The server responded with HTTP ${status}`);
    this.name = "ServerError";
  }
}

export class InvalidServerUrlError extends Error {
  constructor(url: string) {
    super(`"${url}" is not an http:// or https:// URL`);
    this.name = "InvalidServerUrlError";
  }
}

export class CatalogNotFoundError extends Error {
  constructor() {
    super("The server has no OPDS catalog at this URL");
    this.name = "CatalogNotFoundError";
  }
}

function parseBaseUrl(url: string): URL | undefined {
  const withSlash = url.endsWith("/") ? url : `${url}/`;
  if (!URL.canParse(withSlash)) return undefined;
  const parsed = new URL(withSlash);
  return ["http:", "https:"].includes(parsed.protocol) ? parsed : undefined;
}

export function createCalibreWebClient(
  config: CalibreWebConfig,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): CalibreWebClient {
  const base = parseBaseUrl(config.url);
  const authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
  // Links from the server already carry its mount path, so only the extension's own routes are relative to `base`.
  function resolve(path: string): string {
    if (!base) throw new InvalidServerUrlError(config.url);
    return new URL(path, base).toString();
  }

  async function get(path: string, signal?: AbortSignal): Promise<Response> {
    const url = resolve(path);
    let response: Response;
    try {
      response = await fetch(url, { headers: { Authorization: authorization }, signal });
    } catch (error) {
      throw new NetworkError(error);
    }
    if (response.status === 401) throw new AuthError();
    if (!response.ok) throw new ServerError(response.status);
    return response;
  }

  async function getFeedPage(path: string) {
    try {
      return parseFeed(await (await get(path)).text());
    } catch (error) {
      if (error instanceof InvalidFeedError || (error instanceof ServerError && error.status === 404)) {
        throw new CatalogNotFoundError();
      }
      throw error;
    }
  }

  return {
    async fetchCatalog() {
      const books = new Map<number, Book>();
      const visited = new Set<string>();
      let next: string | undefined = "opds/new";
      while (next && !visited.has(next)) {
        visited.add(next);
        const page = await getFeedPage(next);
        for (const book of page.books) if (!books.has(book.id)) books.set(book.id, book);
        next = page.next;
      }
      return [...books.values()];
    },
    download: get,
    readerUrl: (id, format) => resolve(`read/${id}/${format}`),
    bookUrl: (id) => resolve(`book/${id}`),
  };
}
