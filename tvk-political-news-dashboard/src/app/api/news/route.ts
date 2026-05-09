/**
 * GET /api/news
 * Returns paginated news articles with optional filters.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { newsArticles } from "@/db/schema";
import { desc, eq, and, gte, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
    const category = searchParams.get("category");
    const sentiment = searchParams.get("sentiment");
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(newsArticles.isActive, true)];

    if (category && category !== "All") {
      conditions.push(eq(newsArticles.category, category));
    }

    if (sentiment && sentiment !== "All") {
      conditions.push(eq(newsArticles.sentimentLabel, sentiment));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [articles, countResult] = await Promise.all([
      db
        .select()
        .from(newsArticles)
        .where(whereClause)
        .orderBy(desc(newsArticles.publishedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(newsArticles)
        .where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      articles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[News API]", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}
