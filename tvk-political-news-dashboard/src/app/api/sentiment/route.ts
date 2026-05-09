/**
 * GET /api/sentiment
 * Returns sentiment statistics and weekly trend data.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { newsArticles, sentimentSummary } from "@/db/schema";
import { desc, gte, sql, and, eq } from "drizzle-orm";
import { subDays, format } from "date-fns";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sevenDaysAgo = subDays(new Date(), 7);

    // Overall sentiment stats (last 30 days)
    const overallStats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE sentiment_label = 'Positive') AS positive,
        COUNT(*) FILTER (WHERE sentiment_label = 'Neutral')  AS neutral,
        COUNT(*) FILTER (WHERE sentiment_label = 'Negative') AS negative,
        COUNT(*)                                             AS total,
        AVG(sentiment_score)                                 AS avg_score,
        MAX(CASE WHEN sentiment_label = 'Positive' THEN sentiment_score END) AS max_positive_score,
        MIN(CASE WHEN sentiment_label = 'Negative' THEN sentiment_score END) AS min_negative_score
      FROM news_articles
      WHERE is_active = true
        AND published_at >= NOW() - INTERVAL '30 days'
    `);

    // Most positive and negative headlines
    const [mostPositive, mostNegative] = await Promise.all([
      db
        .select({ title: newsArticles.title, score: newsArticles.sentimentScore, url: newsArticles.url, source: newsArticles.source })
        .from(newsArticles)
        .where(and(eq(newsArticles.isActive, true), eq(newsArticles.sentimentLabel, "Positive")))
        .orderBy(desc(newsArticles.sentimentScore))
        .limit(1),
      db
        .select({ title: newsArticles.title, score: newsArticles.sentimentScore, url: newsArticles.url, source: newsArticles.source })
        .from(newsArticles)
        .where(and(eq(newsArticles.isActive, true), eq(newsArticles.sentimentLabel, "Negative")))
        .orderBy(newsArticles.sentimentScore)
        .limit(1),
    ]);

    // Weekly trend (last 7 days)
    const weeklyTrend = await db
      .select()
      .from(sentimentSummary)
      .where(gte(sentimentSummary.date, format(sevenDaysAgo, "yyyy-MM-dd")))
      .orderBy(sentimentSummary.date);

    // Fill missing days with zeros
    const trendMap = new Map(weeklyTrend.map((d) => [d.date, d]));
    const filledTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      if (trendMap.has(date)) {
        filledTrend.push(trendMap.get(date));
      } else {
        filledTrend.push({
          date,
          positiveCount: 0,
          neutralCount: 0,
          negativeCount: 0,
          totalArticles: 0,
          avgSentimentScore: 0,
        });
      }
    }

    // News frequency (last 7 days)
    const frequencyResult = await db.execute(sql`
      SELECT
        DATE(published_at) AS date,
        COUNT(*) AS count
      FROM news_articles
      WHERE is_active = true
        AND published_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(published_at)
      ORDER BY date
    `);

    const stats = overallStats.rows[0] as {
      positive: string;
      neutral: string;
      negative: string;
      total: string;
      avg_score: string | null;
    };

    return NextResponse.json({
      overall: {
        positive: parseInt(stats?.positive ?? "0"),
        neutral: parseInt(stats?.neutral ?? "0"),
        negative: parseInt(stats?.negative ?? "0"),
        total: parseInt(stats?.total ?? "0"),
        avgScore: parseFloat(stats?.avg_score ?? "0"),
      },
      mostPositive: mostPositive[0] ?? null,
      mostNegative: mostNegative[0] ?? null,
      weeklyTrend: filledTrend,
      newsFrequency: frequencyResult.rows,
    });
  } catch (error) {
    console.error("[Sentiment API]", error);
    return NextResponse.json(
      { error: "Failed to fetch sentiment data" },
      { status: 500 }
    );
  }
}
