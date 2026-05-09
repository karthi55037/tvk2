/**
 * GET /api/mlas/[id] — get single MLA with criminal cases and related news
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mlas, criminalCases, newsArticles } from "@/db/schema";
import { eq, desc, ilike } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mlaId = parseInt(id);

    if (isNaN(mlaId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [mla] = await db
      .select()
      .from(mlas)
      .where(eq(mlas.id, mlaId))
      .limit(1);

    if (!mla) {
      return NextResponse.json({ error: "MLA not found" }, { status: 404 });
    }

    const cases = await db
      .select()
      .from(criminalCases)
      .where(eq(criminalCases.mlaId, mlaId))
      .orderBy(desc(criminalCases.year));

    // Find related news by name
    const relatedNews = await db
      .select({
        id: newsArticles.id,
        title: newsArticles.title,
        source: newsArticles.source,
        url: newsArticles.url,
        publishedAt: newsArticles.publishedAt,
        sentimentLabel: newsArticles.sentimentLabel,
        sentimentScore: newsArticles.sentimentScore,
      })
      .from(newsArticles)
      .where(ilike(newsArticles.title, `%${mla.name.split(" ")[0]}%`))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(10);

    return NextResponse.json({ mla, cases, relatedNews });
  } catch (error) {
    console.error("[MLA Detail API]", error);
    return NextResponse.json({ error: "Failed to fetch MLA" }, { status: 500 });
  }
}
