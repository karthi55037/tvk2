/**
 * POST /api/news/fetch
 * Fetches RSS feeds, runs sentiment analysis, stores new articles.
 * Called by the internal scheduler.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { newsArticles, sentimentSummary } from "@/db/schema";
import { fetchAllFeeds, categorizeArticle } from "@/lib/rss-fetcher";
import { analyzeSentiment } from "@/lib/sentiment";
import { eq, sql } from "drizzle-orm";
import { format } from "date-fns";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const articles = await fetchAllFeeds();
    let inserted = 0;
    let skipped = 0;

    for (const article of articles) {
      try {
        // Skip if URL already exists
        const existing = await db
          .select({ id: newsArticles.id })
          .from(newsArticles)
          .where(eq(newsArticles.url, article.url))
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // Run sentiment analysis on title + summary
        const textForAnalysis = `${article.title} ${article.summary}`;
        const sentiment = analyzeSentiment(textForAnalysis);

        // Categorize article
        const category = categorizeArticle(article.title, article.summary);

        // Determine related person
        let relatedPerson = "TVK";
        const titleLower = article.title.toLowerCase();
        if (titleLower.includes("vijay")) relatedPerson = "Vijay";

        await db.insert(newsArticles).values({
          title: article.title,
          source: article.source,
          url: article.url,
          imageUrl: article.imageUrl ?? null,
          publishedAt: article.publishedAt,
          summary: article.summary,
          sentimentScore: sentiment.score,
          sentimentLabel: sentiment.label,
          relatedPerson,
          category,
          fetchedAt: new Date(),
          isActive: true,
        });

        inserted++;
      } catch (err) {
        console.warn("[Fetch] Error inserting article:", (err as Error).message);
      }
    }

    // Update daily sentiment summary
    await updateSentimentSummary();

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      total: articles.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Fetch] Error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

async function updateSentimentSummary() {
  const today = format(new Date(), "yyyy-MM-dd");

  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE sentiment_label = 'Positive') AS positive_count,
      COUNT(*) FILTER (WHERE sentiment_label = 'Neutral')  AS neutral_count,
      COUNT(*) FILTER (WHERE sentiment_label = 'Negative') AS negative_count,
      COUNT(*)                                             AS total_articles,
      AVG(sentiment_score)                                 AS avg_sentiment_score
    FROM news_articles
    WHERE DATE(published_at) = ${today}
      AND is_active = true
  `);

  const row = result.rows[0] as {
    positive_count: string;
    neutral_count: string;
    negative_count: string;
    total_articles: string;
    avg_sentiment_score: string | null;
  };

  if (!row) return;

  await db
    .insert(sentimentSummary)
    .values({
      date: today,
      positiveCount: parseInt(row.positive_count ?? "0"),
      neutralCount: parseInt(row.neutral_count ?? "0"),
      negativeCount: parseInt(row.negative_count ?? "0"),
      totalArticles: parseInt(row.total_articles ?? "0"),
      avgSentimentScore: parseFloat(row.avg_sentiment_score ?? "0"),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: sentimentSummary.date,
      set: {
        positiveCount: parseInt(row.positive_count ?? "0"),
        neutralCount: parseInt(row.neutral_count ?? "0"),
        negativeCount: parseInt(row.negative_count ?? "0"),
        totalArticles: parseInt(row.total_articles ?? "0"),
        avgSentimentScore: parseFloat(row.avg_sentiment_score ?? "0"),
        updatedAt: new Date(),
      },
    });
}
