/**
 * Readeck API client for build-time fetching of bookmarks for the postroll page.
 *
 * Reads `READECK_TOKEN` (required) and `READECK_BASE_URL` (optional, defaults to
 * https://readeck.meadow.cafe) from `import.meta.env`. Throws on missing token
 * or any non-2xx response so the build fails loudly.
 */

const DEFAULT_BASE_URL = "https://readeck.meadow.cafe";
const PAGE_SIZE = 100;

/**
 * Subset of the Readeck `bookmarkSummary` schema we consume.
 * See `openapi-spec.json` for the full definition.
 */
export interface BookmarkSummary {
  id: string;
  url: string;
  title: string;
  site: string;
  site_name: string;
  authors: string[];
  description: string;
  created: string;
  updated: string;
  is_marked: boolean;
  is_archived: boolean;
  read_progress: number;
  labels: string[];
  resources?: {
    icon?: { src: string };
    image?: { src: string };
    thumbnail?: { src: string };
  };
}

function getConfig(): { baseUrl: string; token: string } {
  const token = import.meta.env.READECK_TOKEN as string | undefined;
  if (!token) {
    throw new Error(
      "READECK_TOKEN env var is missing. Set it (e.g. in .env) so the postroll page can fetch from Readeck.",
    );
  }
  const baseUrl = ((import.meta.env.READECK_BASE_URL as string | undefined) || DEFAULT_BASE_URL).replace(/\/$/, "");
  return { baseUrl, token };
}

async function fetchPage(
  baseUrl: string,
  token: string,
  filter: "is_archived" | "is_marked",
  offset: number,
): Promise<{ items: BookmarkSummary[]; totalPages: number; currentPage: number }> {
  const url = new URL(`${baseUrl}/api/bookmarks`);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set(filter, "true");
  url.searchParams.set("sort", "-updated");

  const maxAttempts = 4;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`Readeck request failed: ${res.status} ${res.statusText} for ${url.toString()}`);
      }

      const items = (await res.json()) as BookmarkSummary[];
      const totalPages = parseInt(res.headers.get("Total-Pages") || "1", 10);
      const currentPage = parseInt(res.headers.get("Current-Page") || "1", 10);
      return { items, totalPages, currentPage };
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) break;
      const delay = 500 * 2 ** (attempt - 1); // 500, 1000, 2000 ms
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(
    `Readeck request to ${url.toString()} failed after ${maxAttempts} attempts: ${lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

async function fetchAllForFilter(
  baseUrl: string,
  token: string,
  filter: "is_archived" | "is_marked",
): Promise<BookmarkSummary[]> {
  const all: BookmarkSummary[] = [];
  let offset = 0;
  // Cap at a sane number of pages to avoid runaway loops if the server misreports.
  for (let i = 0; i < 100; i++) {
    const { items, totalPages, currentPage } = await fetchPage(baseUrl, token, filter, offset);
    all.push(...items);
    if (currentPage >= totalPages || items.length === 0) break;
    offset += items.length;
  }
  return all;
}

/**
 * Fetches all bookmarks that are either archived (read) or marked (favorite),
 * deduplicated by id and sorted by `updated` descending.
 */
export async function fetchPostrollBookmarks(): Promise<BookmarkSummary[]> {
  const { baseUrl, token } = getConfig();

  const [archived, marked] = await Promise.all([
    fetchAllForFilter(baseUrl, token, "is_archived"),
    fetchAllForFilter(baseUrl, token, "is_marked"),
  ]);

  const byId = new Map<string, BookmarkSummary>();
  for (const b of [...archived, ...marked]) {
    byId.set(b.id, b);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime(),
  );
}
