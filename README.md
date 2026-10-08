<img src="assets/icon.svg" width="64" height="64" alt="">

# raycast-calibre-web

A Raycast extension that searches a Calibre-Web library and opens its books. It is installed locally, not from the Raycast Store.

## Install

```sh
npm install
npm run dev
```

`npm run dev` registers the extension with Raycast. Fill in the server URL, username and password when Raycast asks, then set an alias for "Search Books" under Raycast Settings → Extensions.

## Development

```sh
npm run build      # also generates raycast-env.d.ts, which typecheck needs
npm run lint
npm run typecheck
npm test
```

`npm run lint` runs ESLint and Prettier directly; `ray lint` rejects authors without a Raycast Store account.
