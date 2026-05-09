/**
 * GET /api/mlas — list all MLAs
 * POST /api/mlas — create MLA (internal use)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mlas, criminalCases } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await db
      .select({
        id: mlas.id,
        name: mlas.name,
        constituency: mlas.constituency,
        district: mlas.district,
        party: mlas.party,
        photoUrl: mlas.photoUrl,
        education: mlas.education,
        assets: mlas.assets,
        liabilities: mlas.liabilities,
        criminalCaseCount: mlas.criminalCaseCount,
        affidavitLink: mlas.affidavitLink,
        designation: mlas.designation,
        bio: mlas.bio,
        createdAt: mlas.createdAt,
        updatedAt: mlas.updatedAt,
      })
      .from(mlas)
      .orderBy(mlas.name);

    return NextResponse.json({ mlas: result });
  } catch (error) {
    console.error("[MLAs API]", error);
    return NextResponse.json({ error: "Failed to fetch MLAs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, constituency, district, party = "TVK",
      photoUrl, education, assets, liabilities,
      criminalCaseCount = 0, affidavitLink, designation, bio,
    } = body;

    if (!name || !constituency || !district) {
      return NextResponse.json(
        { error: "name, constituency, and district are required" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(mlas)
      .values({
        name, constituency, district, party,
        photoUrl, education, assets, liabilities,
        criminalCaseCount, affidavitLink, designation, bio,
      })
      .returning();

    return NextResponse.json({ mla: created }, { status: 201 });
  } catch (error) {
    console.error("[MLAs POST]", error);
    return NextResponse.json({ error: "Failed to create MLA" }, { status: 500 });
  }
}
