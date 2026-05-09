/**
 * GET /api/stats — dashboard summary statistics
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { mlas, criminalCases, newsArticles, manifestoPromises } from "@/db/schema";
import { sql, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [
      mlaCount,
      totalCases,
      newsCount,
      manifestoCount,
      recentNews,
    ] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(mlas),
      db.select({ count: sql<number>`COUNT(*)` }).from(criminalCases),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(newsArticles)
        .where(eq(newsArticles.isActive, true)),
      db.select({ count: sql<number>`COUNT(*)` }).from(manifestoPromises),
      // Latest 5 news for ticker
      db
        .select({
          id: newsArticles.id,
          title: newsArticles.title,
          source: newsArticles.source,
          url: newsArticles.url,
          sentimentLabel: newsArticles.sentimentLabel,
          publishedAt: newsArticles.publishedAt,
        })
        .from(newsArticles)
        .where(eq(newsArticles.isActive, true))
        .orderBy(sql`published_at DESC`)
        .limit(10),
    ]);

    // Manifesto status breakdown
    const manifestoStatus = await db.execute(sql`
      SELECT status, COUNT(*) AS count
      FROM manifesto_promises
      GROUP BY status
    `);

    return NextResponse.json({
      stats: {
        totalMLAs: Number(mlaCount[0]?.count ?? 0),
        totalCriminalCases: Number(totalCases[0]?.count ?? 0),
        totalNewsArticles: Number(newsCount[0]?.count ?? 0),
        totalManifestoPromises: Number(manifestoCount[0]?.count ?? 0),
      },
      recentNews,
      manifestoStatus: manifestoStatus.rows,
    });
  } catch (error) {
    console.error("[Stats API]", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
