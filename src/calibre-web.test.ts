import { describe, expect, it } from "vitest";
import { fixture } from "./__fixtures__/fixture";
import { AuthError, NetworkError, createCalibreWebClient } from "./calibre-web";
import { InvalidFeedError } from "./opds";

const config = { url: "https://books.example.ts.net/", username: "raycast", password: "s3cret" };

const unauthorized = (async () => new Response("Unauthorized Access", { status: 401 })) as typeof globalThis.fetch;

function fakeFetch(pages: Record<string, string>) {
  const requests: { url: string; authorization: string | null }[] = [];
  const fetch = async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, authorization: new Headers(init?.headers).get("Authorization") });
    const body = pages[url];
    return body === undefined ? new Response("Not Found", { status: 404 }) : new Response(body);
  };
  return { fetch: fetch as typeof globalThis.fetch, requests };
}

describe("fetchCatalog", () => {
  it("follows next links from the newest-first feed and returns every book", async () => {
    const { fetch, requests } = fakeFetch({
      "https://books.example.ts.net/opds/new": fixture("new-page-1.xml"),
      "https://books.example.ts.net/opds/new?offset=2": fixture("new-page-2.xml"),
    });

    const books = await createCalibreWebClient(config, fetch).fetchCatalog();

    expect(books.map((book) => book.id)).toEqual([412, 7, 9, 3]);
    expect(requests.map((request) => request.url)).toEqual([
      "https://books.example.ts.net/opds/new",
      "https://books.example.ts.net/opds/new?offset=2",
    ]);
  });

  it("sends the credentials as HTTP basic auth", async () => {
    const { fetch, requests } = fakeFetch({ "https://books.example.ts.net/opds/new": fixture("new-page-2.xml") });

    await createCalibreWebClient(config, fetch).fetchCatalog();

    expect(requests[0].authorization).toBe("Basic cmF5Y2FzdDpzM2NyZXQ=");
  });

  it("rejects with an AuthError when the server refuses the credentials", async () => {
    await expect(createCalibreWebClient(config, unauthorized).fetchCatalog()).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects with a NetworkError when the server is unreachable", async () => {
    const fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof globalThis.fetch;

    await expect(createCalibreWebClient(config, fetch).fetchCatalog()).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("fetchCatalog edge cases", () => {
  it("stops when a next link repeats and returns each book once", async () => {
    const { fetch, requests } = fakeFetch({
      "https://books.example.ts.net/opds/new": fixture("new-page-1.xml"),
      "https://books.example.ts.net/opds/new?offset=2": fixture("new-page-1.xml"),
    });

    const books = await createCalibreWebClient(config, fetch).fetchCatalog();

    expect(books.map((book) => book.id)).toEqual([412, 7, 9]);
    expect(requests).toHaveLength(2);
  });

  it("rejects with an InvalidFeedError when the server answers with something other than a feed", async () => {
    const { fetch } = fakeFetch({ "https://books.example.ts.net/opds/new": "<html><body>Login</body></html>" });

    await expect(createCalibreWebClient(config, fetch).fetchCatalog()).rejects.toBeInstanceOf(InvalidFeedError);
  });

  it("keeps the server's own links intact when it is mounted under a path", async () => {
    const { fetch, requests } = fakeFetch({
      "https://books.example.ts.net/calibre/opds/new": fixture("new-page-2.xml").replaceAll(
        'href="/',
        'href="/calibre/',
      ),
      "https://books.example.ts.net/calibre/opds/download/3/mobi/": "MOBI",
    });
    const client = createCalibreWebClient({ ...config, url: "https://books.example.ts.net/calibre" }, fetch);

    const [book] = await client.fetchCatalog();
    await client.download(book.files[0].path);

    expect(requests.map((request) => request.url)).toEqual([
      "https://books.example.ts.net/calibre/opds/new",
      "https://books.example.ts.net/calibre/opds/download/3/mobi/",
    ]);
  });
});

describe("links", () => {
  const client = createCalibreWebClient(config, fakeFetch({}).fetch);

  it("points the reader and book page at the web UI", () => {
    expect(client.readerUrl(412, "pdf")).toBe("https://books.example.ts.net/read/412/pdf");
    expect(client.bookUrl(412)).toBe("https://books.example.ts.net/book/412");
  });
});

describe("download", () => {
  it("fetches a book file with basic auth", async () => {
    const { fetch, requests } = fakeFetch({ "https://books.example.ts.net/opds/download/412/pdf/": "%PDF-1.7" });

    const response = await createCalibreWebClient(config, fetch).download("/opds/download/412/pdf/");

    expect(await response.text()).toBe("%PDF-1.7");
    expect(requests[0].authorization).toBe("Basic cmF5Y2FzdDpzM2NyZXQ=");
  });

  it("rejects with an AuthError when the user may not download", async () => {
    await expect(
      createCalibreWebClient(config, unauthorized).download("/opds/download/412/pdf/"),
    ).rejects.toBeInstanceOf(AuthError);
  });
});
