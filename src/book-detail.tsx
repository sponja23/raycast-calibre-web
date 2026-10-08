import { Icon, List } from "@raycast/api";
import { Book, filesByPreference, formatSize, languageName } from "./book";
import { FileCache } from "./file-cache";

interface BookDetailProps {
  book: Book;
  cache: FileCache;
  url: string;
}

export function BookDetail({ book, cache, url }: BookDetailProps) {
  const markdown = [`## ${book.title}`, ...(book.summary ? [book.summary] : [])].join("\n\n");
  return (
    <List.Item.Detail
      markdown={markdown}
      metadata={
        <List.Item.Detail.Metadata>
          {book.authors.length > 0 && (
            <List.Item.Detail.Metadata.Label
              title={book.authors.length > 1 ? "Authors" : "Author"}
              text={book.authors.join(", ")}
            />
          )}
          {book.tags.length > 0 && (
            <List.Item.Detail.Metadata.TagList title="Tags">
              {book.tags.map((tag) => (
                <List.Item.Detail.Metadata.TagList.Item key={tag} text={tag} />
              ))}
            </List.Item.Detail.Metadata.TagList>
          )}
          {book.year && <List.Item.Detail.Metadata.Label title="Year" text={String(book.year)} />}
          {book.publisher && <List.Item.Detail.Metadata.Label title="Publisher" text={book.publisher} />}
          {book.language && <List.Item.Detail.Metadata.Label title="Language" text={languageName(book.language)} />}
          <List.Item.Detail.Metadata.Separator />
          {filesByPreference(book).map((file) => (
            <List.Item.Detail.Metadata.Label
              key={file.format}
              title={file.format.toUpperCase()}
              text={formatSize(file.size)}
              icon={cache.isCached(book.id, file) ? Icon.HardDrive : undefined}
            />
          ))}
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Link title="Calibre-Web" text="Open Book Page" target={url} />
        </List.Item.Detail.Metadata>
      }
    />
  );
}
