import { describe, expect, it } from "vitest";
import { createCalibreWebClient } from "./calibre-web";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; put it in .env.local`);
  return value;
}

describe("the live server", () => {
  const client = createCalibreWebClient({
    url: env("CALIBRE_URL"),
    username: env("CALIBRE_USER"),
    password: env("CALIBRE_PASSWORD"),
  });

  it("serves the whole catalog with a downloadable file and a sane year for every book", async () => {
    const books = await client.fetchCatalog();

    expect(books.length).toBeGreaterThan(500);
    expect(new Set(books.map((book) => book.id)).size).toBe(books.length);
    for (const book of books) {
      expect(book.files.length).toBeGreaterThan(0);
      if (book.year !== undefined) expect(book.year).toBeGreaterThan(1000);
    }
  }, 120_000);

  it("lets the user download a book", async () => {
    const [book] = await client.fetchCatalog();
    const controller = new AbortController();

    const response = await client.download(book.files[0].path, controller.signal);
    controller.abort();

    expect(response.status).toBe(200);
  }, 120_000);
});
