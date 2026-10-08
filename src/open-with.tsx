import { Action, ActionPanel, List, getApplications } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { Book, BookFile } from "./book";
import { FileCache } from "./file-cache";
import { downloadWithToast, openBook } from "./open-book";

export function OpenWith({ book, file, files }: { book: Book; file: BookFile; files: FileCache }) {
  const { data: apps, isLoading } = usePromise(
    async () => getApplications(await downloadWithToast(files, book.id, file)),
    [],
    { onError: () => undefined },
  );

  return (
    <List isLoading={isLoading} navigationTitle={`Open ${book.title} With`}>
      {apps?.map((app) => (
        <List.Item
          key={app.path}
          title={app.name}
          icon={{ fileIcon: app.path }}
          actions={
            <ActionPanel>
              <Action title={`Open in ${app.name}`} onAction={() => openBook(files, book.id, file, app)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
