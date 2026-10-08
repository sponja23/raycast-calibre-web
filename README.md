<img src="media/icon.svg" width="64" height="64" alt="">

# Calibre-Web Library

Search a [Calibre-Web](https://github.com/janeczku/calibre-web) library from Raycast and open its books.

It talks to a Calibre-Web server over the network, so it suits a library that lives on another machine. If your library is a local calibre installation on this Mac, use the [Calibre Library](https://www.raycast.com/BrunoMonteiro/calibre-library) extension instead.

The catalog is cached locally, so search is instant and still works offline. Books you open are downloaded once and kept in `~/Library/Caches/raycast-calibre-web`, up to a size limit you choose; opening a book that isn't cached needs the server.

## Setup

The first time you run **Search Books**, Raycast asks for:

- **Server URL**: the address of your Calibre-Web server, including `https://` (or `http://`).
- **Username** and **Password**: a Calibre-Web user with the **download** role.
- **File Cache Limit (GB)**: optional, 2 GB by default.

The extension reads the server's OPDS catalog at `/opds` with HTTP basic auth. Calibre-Web serves it by default; if a reverse proxy sits in front of the server, make sure `/opds` is reachable and basic auth passes through. The user must also be able to see the **Recently Added** view, because the catalog is read from that feed. Calibre-Web Automated works too.

## Actions

| Action            | Shortcut | What it does                                                       |
| ----------------- | -------- | ------------------------------------------------------------------ |
| Open in _app_     | ↵        | Downloads the book if needed and opens it with the default app     |
| Open in Browser   | ⌘↵       | Opens the book in Calibre-Web's reader (uses your browser session) |
| Open with         | ⌘O       | Picks another app                                                  |
| Copy Link         | ⌘⇧C      | Copies the book's Calibre-Web page                                 |
| Show Details      | ⌘D       | Toggles a side panel with the book's metadata and formats          |
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
