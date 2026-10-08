import {
  Action,
  ActionPanel,
  Alert,
  Application,
  Icon,
  Keyboard,
  List,
  Toast,
  confirmAlert,
  showToast,
  useNavigation,
} from "@raycast/api";
import { showFailureToast, useCachedPromise, useCachedState, usePromise } from "@raycast/utils";
import { useMemo, useRef, useState } from "react";
import { Book, BookFile, preferredFile, readerFile } from "./book";
import { BookDetail } from "./book-detail";
import { defaultApps } from "./default-apps";
import { describeRefreshFailure } from "./failure";
import { showFailure } from "./failure-toast";
import { fetchCatalog, loadLibrary } from "./library";
import { openBook } from "./open-book";
import { OpenWith } from "./open-with";

const ALL_BOOKS = "";

export default function Command() {
  const { client, cache, preferences } = useMemo(loadLibrary, []);
  const { push } = useNavigation();
  const [tag, setTag] = useState(ALL_BOOKS);
  const [showingDetail, setShowingDetail] = useCachedState("showing-detail", false);
  const [, setCacheVersion] = useState(0);
  const refreshCacheIcons = () => setCacheVersion((version) => version + 1);

  const hasCachedBooks = useRef(false);
  const { data: books = [], isLoading } = useCachedPromise(
    fetchCatalog,
    [preferences.serverUrl, preferences.username],
    { onError: (error) => showFailure(describeRefreshFailure(error, hasCachedBooks.current)) },
  );
  hasCachedBooks.current = books.length > 0;

  const formats = useMemo(() => [...new Set(books.flatMap((book) => book.files.map((file) => file.format)))], [books]);
  const { data: apps } = usePromise(defaultApps, [formats], { onError: () => undefined });

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const book of books) for (const name of book.tags) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [books]);

  const shown = tag === ALL_BOOKS ? books : books.filter((book) => book.tags.includes(tag));

  function openWith(book: Book, file: BookFile) {
    push(<OpenWith book={book} file={file} cache={cache} onOpened={refreshCacheIcons} />);
  }

  async function openDefault(book: Book, file: BookFile, app: Application | undefined) {
    if (apps && !app) {
      await showToast({
        style: Toast.Style.Failure,
        title: `No app opens .${file.format} files`,
        primaryAction: { title: "Open with", onAction: () => openWith(book, file) },
      });
      return;
    }
    await openBook(cache, book.id, file, app);
    refreshCacheIcons();
  }

  async function changeCache(change: () => Promise<void>, done: string) {
    try {
      await change();
      await showToast({ style: Toast.Style.Success, title: done });
    } catch (error) {
      await showFailureToast(error, { title: "Could not change the cache" });
    }
    refreshCacheIcons();
  }

  async function clearCache() {
    const confirmed = await confirmAlert({
      title: "Clear the book cache?",
      message: "Every downloaded book is deleted and downloaded again on its next open.",
      primaryAction: { title: "Clear Cache", style: Alert.ActionStyle.Destructive },
    });
    if (confirmed) await changeCache(cache.clear, "Cache cleared");
  }

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={showingDetail}
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
        if (!file) return null;
        const reader = readerFile(book);
        const cached = cache.isCached(book.id, file);
        const app = apps?.[file.format];
        return (
          <List.Item
            key={book.id}
            icon={Icon.Book}
            title={book.title}
            subtitle={book.authors.join(", ")}
            keywords={[...book.authors, ...book.tags, ...(book.year ? [String(book.year)] : [])]}
            accessories={[
              ...(cached ? [{ icon: Icon.HardDrive, tooltip: "Downloaded" }] : []),
              ...(!showingDetail && book.tags[0] ? [{ tag: book.tags[0] }] : []),
              ...(!showingDetail && book.year ? [{ text: String(book.year) }] : []),
            ]}
            detail={showingDetail && <BookDetail book={book} cache={cache} url={client.bookUrl(book.id)} />}
            actions={
              <ActionPanel>
                <Action
                  title={app ? `Open in ${app.name}` : "Open"}
                  icon={Icon.Book}
                  onAction={() => openDefault(book, file, app)}
                />
                {reader && (
                  <Action.OpenInBrowser title="Open in Browser" url={client.readerUrl(book.id, reader.format)} />
                )}
                <Action
                  title="Open with"
                  icon={Icon.AppWindowList}
                  shortcut={Keyboard.Shortcut.Common.OpenWith}
                  onAction={() => openWith(book, file)}
                />
                <Action.CopyToClipboard
                  title="Copy Link"
                  content={client.bookUrl(book.id)}
                  shortcut={Keyboard.Shortcut.Common.Copy}
                />
                <Action
                  title={showingDetail ? "Hide Details" : "Show Details"}
                  icon={Icon.Sidebar}
                  shortcut={{ modifiers: ["cmd"], key: "d" }}
                  onAction={() => setShowingDetail(!showingDetail)}
                />
                <ActionPanel.Section>
                  {cached && (
                    <Action
                      title="Remove from Cache"
                      icon={Icon.Trash}
                      style={Action.Style.Destructive}
                      shortcut={Keyboard.Shortcut.Common.Remove}
                      onAction={() => changeCache(() => cache.remove(book.id), "Removed from cache")}
                    />
                  )}
                  <Action
                    title="Clear Cache"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={Keyboard.Shortcut.Common.RemoveAll}
                    onAction={clearCache}
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
