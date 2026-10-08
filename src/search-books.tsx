import {
  Action,
  ActionPanel,
  Icon,
  Keyboard,
  List,
  Toast,
  openExtensionPreferences,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useCachedPromise, usePromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { Book, preferredFile, readerFile } from "./book";
import { defaultApps } from "./default-apps";
import { loadLibrary } from "./library";
import { openBook } from "./open-book";
import { OpenWith } from "./open-with";
import { AuthError, NetworkError } from "./server";

const ALL_BOOKS = "";

export default function Command() {
  const { server, files } = useMemo(loadLibrary, []);
  const { push } = useNavigation();
  const [tag, setTag] = useState(ALL_BOOKS);
  const [, setCacheVersion] = useState(0);
  const refreshCacheIcons = () => setCacheVersion((version) => version + 1);

  const { data: books = [], isLoading } = useCachedPromise(server.fetchCatalog, [], {
    keepPreviousData: true,
    onError: showRefreshError,
  });

  const formats = useMemo(() => [...new Set(books.flatMap((book) => book.files.map((file) => file.format)))], [books]);
  const { data: apps = {} } = usePromise(defaultApps, [formats]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const book of books) for (const name of book.tags) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [books]);

  const shown = tag === ALL_BOOKS ? books : books.filter((book) => book.tags.includes(tag));

  function openWith(book: Book) {
    const file = preferredFile(book);
    if (file) push(<OpenWith book={book} file={file} files={files} />);
  }

  async function openDefault(book: Book) {
    const file = preferredFile(book);
    if (!file) return;
    const app = apps[file.format];
    if (!app) {
      await showToast({
        style: Toast.Style.Failure,
        title: `No app opens .${file.format} files`,
        primaryAction: { title: "Open with", onAction: () => openWith(book) },
      });
      return;
    }
    await openBook(files, book.id, file, app);
    refreshCacheIcons();
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search books by title, author or tag"
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by tag" value={tag} onChange={setTag}>
          <List.Dropdown.Item title="All books" value={ALL_BOOKS} />
          <List.Dropdown.Section>
            {tagCounts.map(([name, count]) => (
              <List.Dropdown.Item key={name} title={`${name} (${count})`} value={name} />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {shown.map((book) => {
        const file = preferredFile(book);
        const reader = readerFile(book);
        const cached = file !== undefined && files.isCached(book.id, file);
        const app = file && apps[file.format];
        return (
          <List.Item
            key={book.id}
            icon={Icon.Book}
            title={book.title}
            subtitle={book.authors.join(", ")}
            keywords={[...book.authors, ...book.tags, ...(book.year ? [String(book.year)] : [])]}
            accessories={[
              ...(cached ? [{ icon: Icon.HardDrive, tooltip: "Downloaded" }] : []),
              ...(book.tags[0] ? [{ tag: book.tags[0] }] : []),
              ...(book.year ? [{ text: String(book.year) }] : []),
            ]}
            actions={
              <ActionPanel>
                <Action
                  title={app ? `Open in ${app.name}` : "Open"}
                  icon={Icon.Book}
                  onAction={() => openDefault(book)}
                />
                {reader && (
                  <Action.OpenInBrowser title="Open in Browser" url={server.readerUrl(book.id, reader.format)} />
                )}
                <Action
                  title="Open with"
                  icon={Icon.AppWindowList}
                  shortcut={Keyboard.Shortcut.Common.OpenWith}
                  onAction={() => openWith(book)}
                />
                <Action.CopyToClipboard
                  title="Copy Link"
                  content={server.bookUrl(book.id)}
                  shortcut={Keyboard.Shortcut.Common.Copy}
                />
                <ActionPanel.Section>
                  {cached && (
                    <Action
                      title="Remove from Cache"
                      icon={Icon.Trash}
                      style={Action.Style.Destructive}
                      shortcut={Keyboard.Shortcut.Common.Remove}
                      onAction={() => files.remove(book.id).then(refreshCacheIcons)}
                    />
                  )}
                  <Action
                    title="Clear Cache"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={Keyboard.Shortcut.Common.RemoveAll}
                    onAction={() => files.clear().then(refreshCacheIcons)}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

function showRefreshError(error: Error) {
  if (error instanceof AuthError) {
    showToast({
      style: Toast.Style.Failure,
      title: "Calibre-Web rejected the credentials",
      primaryAction: { title: "Open Preferences", onAction: () => openExtensionPreferences() },
    });
  } else if (error instanceof NetworkError) {
    showToast({ style: Toast.Style.Failure, title: "Offline", message: "Showing the cached library" });
  } else {
    showToast({ style: Toast.Style.Failure, title: "Could not refresh the library", message: error.message });
  }
}
