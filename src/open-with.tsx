import { Action, ActionPanel, List } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { Book, BookFile } from "./book";
import { appsFor } from "./default-apps";
import { FileCache } from "./file-cache";
import { openBook } from "./open-book";

interface OpenWithProps {
  book: Book;
  file: BookFile;
  cache: FileCache;
  onOpened: () => void;
}

export function OpenWith({ book, file, cache, onOpened }: OpenWithProps) {
  const { data: apps, isLoading } = usePromise(appsFor, [file.format]);

  return (
    <List isLoading={isLoading} navigationTitle={`Open ${book.title} with`}>
      {apps?.map((app) => (
        <List.Item
          key={app.path}
          title={app.name}
          icon={{ fileIcon: app.path }}
          actions={
            <ActionPanel>
              <Action
                title={`Open in ${app.name}`}
                onAction={() => openBook(cache, book.id, file, app).then(onOpened)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
