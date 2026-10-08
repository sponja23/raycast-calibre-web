import { Book } from "./book";
import { parseFeed } from "./opds";

export interface ServerConfig {
  url: string;
  username: string;
  password: string;
}

export interface Server {
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
  constructor(status: number) {
    super(`The server responded with HTTP ${status}`);
    this.name = "ServerError";
  }
}

export function createServer(config: ServerConfig, fetch: typeof globalThis.fetch = globalThis.fetch): Server {
  const base = config.url.endsWith("/") ? config.url : `${config.url}/`;
  const authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
  const resolve = (path: string) => new URL(path.replace(/^\//, ""), base).toString();

  async function get(path: string, signal?: AbortSignal): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(resolve(path), { headers: { Authorization: authorization }, signal });
    } catch (error) {
      throw new NetworkError(error);
    }
    if (response.status === 401) throw new AuthError();
    if (!response.ok) throw new ServerError(response.status);
    return response;
  }

  return {
    async fetchCatalog() {
      const books: Book[] = [];
      let next: string | undefined = "/opds/new";
      while (next) {
        const page = parseFeed(await (await get(next)).text());
        books.push(...page.books);
        next = page.next;
      }
      return books;
    },
    download: get,
    readerUrl: (id, format) => resolve(`read/${id}/${format}`),
    bookUrl: (id) => resolve(`book/${id}`),
  };
}
