/**
 * RSS Feed Fetcher
 * Fetches news from public RSS feeds about TVK / Vijay / Tamil Nadu politics.
 * All sources are public RSS feeds — no illegal scraping.
 */

import Parser from "rss-parser";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; TVKNewsBot/1.0; +https://tvk-news.vercel.app)",
    Accept: "application/rss+xml, application/xml, text/xml",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["enclosure", "enclosure"],
    ],
  },
});

export interface RSSArticle {
  title: string;
  url: string;
  source: string;
  summary: string;
  publishedAt: Date;
  imageUrl?: string;
}

// Public RSS feeds — all free and legal
const RSS_FEEDS: { url: string; source: string }[] = [
  {
    url: "https://news.google.com/rss/search?q=TVK+Vijay+Tamil+Nadu&hl=en-IN&gl=IN&ceid=IN:en",
    source: "Google News",
  },
  {
    url: "https://news.google.com/rss/search?q=Tamilaga+Vettri+Kazhagam&hl=en-IN&gl=IN&ceid=IN:en",
    source: "Google News",
  },
  {
    url: "https://news.google.com/rss/search?q=Vijay+TVK+Tamil+Nadu+politics&hl=en-IN&gl=IN&ceid=IN:en",
    source: "Google News",
  },
  {
    url: "https://news.google.com/rss/search?q=TVK+party+Tamil+Nadu+election&hl=en-IN&gl=IN&ceid=IN:en",
    source: "Google News",
  },
  {
    url: "https://news.google.com/rss/search?q=Vijay+actor+politician+Tamil&hl=en-IN&gl=IN&ceid=IN:en",
    source: "Google News",
  },
];

function extractImageFromItem(item: Record<string, unknown>): string | undefined {
  try {
    // Try media:thumbnail
    const mediaThumbnail = item["mediaThumbnail"] as Record<string, unknown> | undefined;
    if (mediaThumbnail?.["$"]) {
      const attrs = mediaThumbnail["$"] as Record<string, string>;
      if (attrs.url) return attrs.url;
    }

    // Try media:content
    const mediaContent = item["mediaContent"] as Record<string, unknown> | undefined;
    if (mediaContent?.["$"]) {
      const attrs = mediaContent["$"] as Record<string, string>;
      if (attrs.url) return attrs.url;
    }

    // Try enclosure
    const enclosure = item["enclosure"] as Record<string, string> | undefined;
    if (enclosure?.url) return enclosure.url;
  } catch {
    // ignore parse errors
  }
  return undefined;
}

function cleanSummary(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export async function fetchAllFeeds(): Promise<RSSArticle[]> {
  const articles: RSSArticle[] = [];
  const seenUrls = new Set<string>();

  const feedPromises = RSS_FEEDS.map(async ({ url, source }) => {
    try {
      const feed = await parser.parseURL(url);
      const items: RSSArticle[] = [];

      for (const item of feed.items ?? []) {
        const articleUrl = item.link ?? item.guid ?? "";
        if (!articleUrl || seenUrls.has(articleUrl)) continue;

        const rawItem = item as unknown as Record<string, unknown>;
        const imageUrl = extractImageFromItem(rawItem);

        const publishedAt = item.pubDate
          ? new Date(item.pubDate)
          : item.isoDate
          ? new Date(item.isoDate)
          : new Date();

        items.push({
          title: item.title ?? "Untitled",
          url: articleUrl,
          source,
          summary: cleanSummary(item.contentSnippet ?? item.content ?? item.summary ?? ""),
          publishedAt,
          imageUrl,
        });

        seenUrls.add(articleUrl);
      }

      return items;
    } catch (err) {
      console.warn(`[RSS] Failed to fetch ${url}:`, (err as Error).message);
      return [];
    }
  });

  const results = await Promise.allSettled(feedPromises);
  for (const result of results) {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    }
  }

  // Sort by published date (newest first)
  articles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return articles;
}

/**
 * Categorize article based on keywords in title/summary.
 */
export function categorizeArticle(
  title: string,
  summary: string
): string {
  const text = `${title} ${summary}`.toLowerCase();

  if (/criminal|fir|case|arrest|court|police|charge|allegation|ipc/i.test(text)) {
    return "Criminal";
  }
  if (/manifesto|promise|announce|scheme|welfare|plan|policy/i.test(text)) {
    return "Manifesto";
  }
  if (/mla|legislator|assembly|constituency|district|candidate/i.test(text)) {
    return "MLA";
  }
  if (/vijay|leader|president|chief/i.test(text)) {
    return "Leader";
  }
  if (/tvk|tamilaga vettri|party|kazhagam/i.test(text)) {
    return "Party";
  }
  return "General";
}
