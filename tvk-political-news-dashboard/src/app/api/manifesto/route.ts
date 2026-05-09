/**
 * GET /api/manifesto — list manifesto promises
 * POST /api/manifesto — create promise
 * PATCH /api/manifesto/[id] — update status
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { manifestoPromises, newsArticles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  try {
    const promises = await db
      .select()
      .from(manifestoPromises)
      .orderBy(manifestoPromises.category, desc(manifestoPromises.updatedAt));

    // For each promise, fetch related news IDs
    const enriched = await Promise.all(
      promises.map(async (p) => {
        let relatedNews: { id: number; title: string; url: string; publishedAt: Date | null }[] = [];

        if (p.relatedNewsIds) {
          const ids = p.relatedNewsIds
            .split(",")
            .map((s) => parseInt(s.trim()))
            .filter((n) => !isNaN(n));

          if (ids.length > 0) {
            const news = await db
              .select({
                id: newsArticles.id,
                title: newsArticles.title,
                url: newsArticles.url,
                publishedAt: newsArticles.publishedAt,
              })
              .from(newsArticles)
              .where(eq(newsArticles.isActive, true))
              .limit(3);

            relatedNews = news;
          }
        }

        return { ...p, relatedNews };
      })
    );

    return NextResponse.json({ promises: enriched });
  } catch (error) {
    console.error("[Manifesto API]", error);
    return NextResponse.json({ error: "Failed to fetch manifesto" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      promise, category = "General", status = "Announced",
      progressPercent = 0, details, targetDate,
    } = body;

    if (!promise) {
      return NextResponse.json({ error: "promise is required" }, { status: 400 });
    }

    const [created] = await db
      .insert(manifestoPromises)
      .values({
        promise, category, status, progressPercent,
        details, targetDate,
      })
      .returning();

    return NextResponse.json({ promise: created }, { status: 201 });
  } catch (error) {
    console.error("[Manifesto POST]", error);
    return NextResponse.json({ error: "Failed to create promise" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, progressPercent } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const [updated] = await db
      .update(manifestoPromises)
      .set({
        ...(status && { status }),
        ...(progressPercent !== undefined && { progressPercent }),
        updatedAt: new Date(),
      })
      .where(eq(manifestoPromises.id, id))
      .returning();

    return NextResponse.json({ promise: updated });
  } catch (error) {
    console.error("[Manifesto PATCH]", error);
    return NextResponse.json({ error: "Failed to update promise" }, { status: 500 });
  }
}
