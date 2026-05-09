/**
 * GET /api/criminal-cases — all criminal cases with MLA info
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { criminalCases, mlas } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const caseType = searchParams.get("type");
    const district = searchParams.get("district");

    const cases = await db
      .select({
        id: criminalCases.id,
        mlaId: criminalCases.mlaId,
        mlaName: mlas.name,
        mlaConstituency: mlas.constituency,
        mlaDistrict: mlas.district,
        mlaPhotoUrl: mlas.photoUrl,
        caseType: criminalCases.caseType,
        ipcSections: criminalCases.ipcSections,
        courtName: criminalCases.courtName,
        district: criminalCases.district,
        year: criminalCases.year,
        status: criminalCases.status,
        description: criminalCases.description,
        sourceReference: criminalCases.sourceReference,
      })
      .from(criminalCases)
      .leftJoin(mlas, eq(criminalCases.mlaId, mlas.id))
      .orderBy(criminalCases.year);

    // Filter client-side for now (or add SQL conditions if needed)
    let filtered = cases;
    if (caseType && caseType !== "All") {
      filtered = filtered.filter((c) => c.caseType === caseType);
    }
    if (district && district !== "All") {
      filtered = filtered.filter(
        (c) =>
          c.district === district ||
          c.mlaDistrict === district
      );
    }

    // District-wise summary
    const districtSummary = await db.execute(sql`
      SELECT
        cc.district,
        COUNT(*) AS total_cases,
        COUNT(CASE WHEN cc.case_type = 'Corruption' THEN 1 END) AS corruption,
        COUNT(CASE WHEN cc.case_type = 'Assault' THEN 1 END) AS assault,
        COUNT(CASE WHEN cc.case_type = 'Financial' THEN 1 END) AS financial,
        COUNT(CASE WHEN cc.case_type = 'Other' THEN 1 END) AS other
      FROM criminal_cases cc
      GROUP BY cc.district
      ORDER BY total_cases DESC
    `);

    return NextResponse.json({ cases: filtered, districtSummary: districtSummary.rows });
  } catch (error) {
    console.error("[Criminal Cases API]", error);
    return NextResponse.json({ error: "Failed to fetch cases" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      mlaId, caseType, ipcSections, courtName,
      district, year, status = "Pending", description, sourceReference,
    } = body;

    if (!mlaId || !caseType) {
      return NextResponse.json(
        { error: "mlaId and caseType are required" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(criminalCases)
      .values({
        mlaId, caseType, ipcSections, courtName,
        district, year, status, description, sourceReference,
      })
      .returning();

    // Update criminal case count on MLA
    await db.execute(sql`
      UPDATE mlas SET criminal_case_count = (
        SELECT COUNT(*) FROM criminal_cases WHERE mla_id = ${mlaId}
      ) WHERE id = ${mlaId}
    `);

    return NextResponse.json({ case: created }, { status: 201 });
  } catch (error) {
    console.error("[Criminal Cases POST]", error);
    return NextResponse.json({ error: "Failed to create case" }, { status: 500 });
  }
}
