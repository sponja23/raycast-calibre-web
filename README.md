<img src="assets/icon.svg" width="64" height="64" alt="">

# Calibre-Web Library

Search a [Calibre-Web](https://github.com/janeczku/calibre-web) library from Raycast and open its books.

The catalog is cached locally, so search is instant and works offline. Books you open are downloaded once and kept in `~/Library/Caches/raycast-calibre-web`, up to a size limit you choose.

## Setup

The first time you run **Search Books**, Raycast asks for:

- **Server URL**: the address of your Calibre-Web server, including `https://` (or `http://`).
- **Username** and **Password**: a Calibre-Web user with the **download** role.
- **File Cache Limit (GB)**: optional, 2 GB by default.

The extension reads the server's OPDS catalog with HTTP basic auth, so the user must be able to see the **Recently Added** view. Calibre-Web Automated works too.

## Actions

| Action            | Shortcut | What it does                                                       |
| ----------------- | -------- | ------------------------------------------------------------------ |
| Open in _app_     | ↵        | Downloads the book if needed and opens it with the default app     |
| Open in Browser   | ⌘↵       | Opens the book in Calibre-Web's reader (uses your browser session) |
| Open with         | ⌘O       | Picks another app                                                  |
| Copy Link         | ⌘⇧C      | Copies the book's Calibre-Web page                                 |
| Remove from Cache | ⌃X       | Deletes the downloaded copy                                        |
| Clear Cache       | ⌃⇧X      | Deletes every downloaded book                                      |

PDF is preferred when a book has several formats, then EPUB, DjVu and MOBI.

## Development

```sh
npm install
npm run dev        # registers the extension with Raycast
npm run lint
npm run typecheck  # needs raycast-env.d.ts, which npm run dev and npm run build generate
npm test
npm run test:live  # against the server in .env.local (CALIBRE_URL, CALIBRE_USER, CALIBRE_PASSWORD)
```
