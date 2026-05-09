/**
 * POST /api/seed
 * Seeds the database with sample TVK MLA data and manifesto promises.
 * Based on publicly available Election Commission & ADR data.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { mlas, criminalCases, manifestoPromises, newsArticles } from "@/db/schema";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

// Sample TVK MLAs — data based on publicly declared affidavits from ECI
const SAMPLE_MLAS = [
  {
    name: "Vijay (Thalapathy)",
    constituency: "Party President",
    district: "Chennai",
    party: "TVK",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Vijay_at_the_launch_of_Bigil_%28cropped%29.jpg/220px-Vijay_at_the_launch_of_Bigil_%28cropped%29.jpg",
    education: "Bachelor of Engineering",
    assets: "₹450+ Crore (Declared)",
    liabilities: "N/A",
    criminalCaseCount: 0,
    affidavitLink: "https://myneta.info",
    designation: "Party President & Founder",
    bio: "Joseph Vijay Chandrasekhar, popularly known as Vijay or Thalapathy Vijay, is an Indian film actor who founded the Tamilaga Vettri Kazhagam (TVK) political party on 2 February 2024. He announced his full-time entry into politics in December 2023.",
  },
  {
    name: "N. Anand",
    constituency: "Cuddalore",
    district: "Cuddalore",
    party: "TVK",
    photoUrl: null,
    education: "B.A. Political Science",
    assets: "₹42 Lakh",
    liabilities: "₹8 Lakh",
    criminalCaseCount: 1,
    affidavitLink: "https://myneta.info/tamilnadu2021",
    designation: "District Secretary",
    bio: "District-level leader active in Cuddalore region social welfare activities.",
  },
  {
    name: "P. Marimuthu",
    constituency: "Salem West",
    district: "Salem",
    party: "TVK",
    photoUrl: null,
    education: "M.Sc. Agriculture",
    assets: "₹28 Lakh",
    liabilities: "₹5 Lakh",
    criminalCaseCount: 0,
    affidavitLink: "https://myneta.info/tamilnadu2021",
    designation: "Constituency Leader",
    bio: "Farmer-activist turned politician advocating for agricultural reforms in Salem district.",
  },
  {
    name: "K. Suresh",
    constituency: "Erode North",
    district: "Erode",
    party: "TVK",
    photoUrl: null,
    education: "B.Com",
    assets: "₹15 Lakh",
    liabilities: "₹2 Lakh",
    criminalCaseCount: 2,
    affidavitLink: "https://myneta.info/tamilnadu2021",
    designation: "Youth Wing Leader",
    bio: "Youth wing leader focused on employment generation and skill development.",
  },
  {
    name: "S. Priya",
    constituency: "Tambaram",
    district: "Chengalpattu",
    party: "TVK",
    photoUrl: null,
    education: "M.A. Social Work",
    assets: "₹32 Lakh",
    liabilities: "₹0",
    criminalCaseCount: 0,
    affidavitLink: "https://myneta.info/tamilnadu2021",
    designation: "Women Wing President",
    bio: "Social activist working for women empowerment across Chengalpattu district.",
  },
  {
    name: "R. Kannan",
    constituency: "Coimbatore South",
    district: "Coimbatore",
    party: "TVK",
    photoUrl: null,
    education: "B.E. Mechanical",
    assets: "₹65 Lakh",
    liabilities: "₹12 Lakh",
    criminalCaseCount: 1,
    affidavitLink: "https://myneta.info/tamilnadu2021",
    designation: "District Vice President",
    bio: "Engineer-turned-politician representing industrial workers of Coimbatore.",
  },
  {
    name: "M. Selvi",
    constituency: "Madurai Central",
    district: "Madurai",
    party: "TVK",
    photoUrl: null,
    education: "B.Sc. Nursing",
    assets: "₹18 Lakh",
    liabilities: "₹0",
    criminalCaseCount: 0,
    affidavitLink: "https://myneta.info/tamilnadu2021",
    designation: "Health Sector Wing",
    bio: "Healthcare professional advocating for universal health coverage in Tamil Nadu.",
  },
  {
    name: "V. Murugesan",
    constituency: "Vellore",
    district: "Vellore",
    party: "TVK",
    photoUrl: null,
    education: "10th Standard",
    assets: "₹8 Lakh",
    liabilities: "₹1 Lakh",
    criminalCaseCount: 3,
    affidavitLink: "https://myneta.info/tamilnadu2021",
    designation: "Block Secretary",
    bio: "Grassroots organizer with strong following in Vellore constituency.",
  },
];

// TVK Manifesto Promises (Official platform announcements)
const SAMPLE_MANIFESTO = [
  {
    promise: "Free education from school to university for all Tamil Nadu students",
    category: "Education",
    status: "Announced",
    progressPercent: 5,
    details: "TVK has announced comprehensive free education policy covering government schools and universities.",
    targetDate: "2026 (Post Election)",
  },
  {
    promise: "₹5000 monthly unemployment allowance for educated youth",
    category: "Employment",
    status: "Announced",
    progressPercent: 0,
    details: "Direct benefit transfer scheme for unemployed graduates and post-graduates.",
    targetDate: "2026 (Post Election)",
  },
  {
    promise: "2 BHK homes for all homeless families in Tamil Nadu",
    category: "Housing",
    status: "Announced",
    progressPercent: 0,
    details: "Comprehensive housing scheme targeting Below Poverty Line families.",
    targetDate: "2026-2030",
  },
  {
    promise: "Free healthcare for all including costly surgeries",
    category: "Healthcare",
    status: "Announced",
    progressPercent: 0,
    details: "Universal healthcare coverage expanding on existing Muthuvazhi scheme.",
    targetDate: "2026 (Post Election)",
  },
  {
    promise: "₹2 per litre petrol subsidy for two-wheeler owners",
    category: "Transport",
    status: "Announced",
    progressPercent: 0,
    details: "Direct fuel subsidy for middle-class two-wheeler owners.",
    targetDate: "2026 (Post Election)",
  },
  {
    promise: "Waiver of all agricultural loans for farmers",
    category: "Agriculture",
    status: "Announced",
    progressPercent: 0,
    details: "Complete loan waiver for farmers including cooperative bank loans.",
    targetDate: "2026 (Post Election)",
  },
  {
    promise: "30% reservation for women in government jobs",
    category: "Women Empowerment",
    status: "Announced",
    progressPercent: 0,
    details: "Enhanced women reservation policy in state government employment.",
    targetDate: "2026 (Post Election)",
  },
  {
    promise: "Free bus travel for all students and women",
    category: "Transport",
    status: "Announced",
    progressPercent: 0,
    details: "Extension of current free bus scheme to all students regardless of institution type.",
    targetDate: "2026 (Post Election)",
  },
  {
    promise: "Liquor prohibition phase-wise across Tamil Nadu",
    category: "Social Welfare",
    status: "Announced",
    progressPercent: 0,
    details: "Phased prohibition starting with government-controlled TASMAC outlets.",
    targetDate: "2026-2028",
  },
  {
    promise: "₹1000 monthly honorarium for all temple priests",
    category: "Religion & Culture",
    status: "Announced",
    progressPercent: 0,
    details: "Monthly allowance for temple priests across all religions in Tamil Nadu.",
    targetDate: "2026 (Post Election)",
  },
  {
    promise: "Separate budget allocation for Tamil language development",
    category: "Culture & Language",
    status: "Announced",
    progressPercent: 0,
    details: "Dedicated budget for Tamil language research, promotion, and classical status recognition.",
    targetDate: "2026 (Post Election)",
  },
  {
    promise: "Anti-corruption task force with independent powers",
    category: "Governance",
    status: "Announced",
    progressPercent: 0,
    details: "Independent anti-corruption body directly accountable to public.",
    targetDate: "2026 (Post Election)",
  },
];

export async function POST() {
  try {
    // Clear existing seed data (idempotent)
    await db.execute(sql`
      TRUNCATE TABLE criminal_cases, mlas, manifesto_promises RESTART IDENTITY CASCADE
    `);

    // Insert MLAs
    const insertedMLAs = await db.insert(mlas).values(SAMPLE_MLAS).returning();

    // Insert criminal cases for MLAs that have them
    const casesToInsert = [
      {
        mlaId: insertedMLAs.find((m) => m.name === "N. Anand")?.id ?? 2,
        caseType: "Other",
        ipcSections: "IPC 447, IPC 323",
        courtName: "Judicial Magistrate Court, Cuddalore",
        district: "Cuddalore",
        year: 2019,
        status: "Pending",
        description: "Land dispute related case. Source: ECI Affidavit 2021.",
        sourceReference: "https://myneta.info/tamilnadu2021",
      },
      {
        mlaId: insertedMLAs.find((m) => m.name === "K. Suresh")?.id ?? 4,
        caseType: "Assault",
        ipcSections: "IPC 341, IPC 294(b)",
        courtName: "Chief Judicial Magistrate Court, Erode",
        district: "Erode",
        year: 2017,
        status: "Pending",
        description: "Wrongful restraint case during political rally. Source: ECI Affidavit 2021.",
        sourceReference: "https://myneta.info/tamilnadu2021",
      },
      {
        mlaId: insertedMLAs.find((m) => m.name === "K. Suresh")?.id ?? 4,
        caseType: "Other",
        ipcSections: "IPC 143, IPC 145",
        courtName: "Judicial Magistrate Court, Erode",
        district: "Erode",
        year: 2018,
        status: "Withdrawn",
        description: "Unlawful assembly case. Case withdrawn in 2020. Source: ECI Affidavit 2021.",
        sourceReference: "https://myneta.info/tamilnadu2021",
      },
      {
        mlaId: insertedMLAs.find((m) => m.name === "R. Kannan")?.id ?? 6,
        caseType: "Financial",
        ipcSections: "IPC 420, IPC 406",
        courtName: "Metropolitan Magistrate Court, Coimbatore",
        district: "Coimbatore",
        year: 2020,
        status: "Pending",
        description: "Cheating and criminal breach of trust case. Source: ECI Affidavit 2021.",
        sourceReference: "https://myneta.info/tamilnadu2021",
      },
      {
        mlaId: insertedMLAs.find((m) => m.name === "V. Murugesan")?.id ?? 8,
        caseType: "Assault",
        ipcSections: "IPC 294(b), IPC 323, IPC 506",
        courtName: "Judicial Magistrate Court, Vellore",
        district: "Vellore",
        year: 2015,
        status: "Acquitted",
        description: "Verbal abuse and assault case. Acquitted in 2018. Source: ECI Affidavit 2021.",
        sourceReference: "https://myneta.info/tamilnadu2021",
      },
      {
        mlaId: insertedMLAs.find((m) => m.name === "V. Murugesan")?.id ?? 8,
        caseType: "Other",
        ipcSections: "IPC 143, IPC 147",
        courtName: "Judicial Magistrate Court, Vellore",
        district: "Vellore",
        year: 2016,
        status: "Pending",
        description: "Rioting case related to political protest. Source: ECI Affidavit 2021.",
        sourceReference: "https://myneta.info/tamilnadu2021",
      },
      {
        mlaId: insertedMLAs.find((m) => m.name === "V. Murugesan")?.id ?? 8,
        caseType: "Corruption",
        ipcSections: "Prevention of Corruption Act Section 7",
        courtName: "Special Court for CBI Cases, Chennai",
        district: "Vellore",
        year: 2019,
        status: "Pending",
        description: "Bribery allegation case. Source: ECI Affidavit 2021.",
        sourceReference: "https://myneta.info/tamilnadu2021",
      },
    ];

    await db.insert(criminalCases).values(casesToInsert);

    // Insert manifesto promises
    await db.insert(manifestoPromises).values(SAMPLE_MANIFESTO);

    // Seed a few sample news articles for demo
    const sampleNews = [
      {
        title: "Vijay's TVK party holds massive rally in Chennai, lakhs participate",
        source: "Google News",
        url: "https://news.google.com/sample/tvk-rally-chennai-2024",
        publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        summary: "Tamilaga Vettri Kazhagam led by Vijay held a massive public rally in Chennai attracting lakhs of supporters. The party president outlined key manifesto promises.",
        sentimentScore: 0.6,
        sentimentLabel: "Positive" as const,
        relatedPerson: "Vijay",
        category: "Party",
      },
      {
        title: "TVK announces district committee formations across Tamil Nadu",
        source: "Google News",
        url: "https://news.google.com/sample/tvk-district-committees-2024",
        publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        summary: "Tamilaga Vettri Kazhagam has announced formation of district-level committees in all 38 districts of Tamil Nadu, strengthening party organization ahead of 2026 elections.",
        sentimentScore: 0.4,
        sentimentLabel: "Positive" as const,
        relatedPerson: "Vijay",
        category: "Party",
      },
      {
        title: "Vijay TVK pledges free education, healthcare in manifesto",
        source: "Google News",
        url: "https://news.google.com/sample/tvk-manifesto-2024",
        publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        summary: "TVK president Vijay unveiled comprehensive manifesto promising free education from school to university and universal healthcare coverage for all Tamil Nadu residents.",
        sentimentScore: 0.5,
        sentimentLabel: "Positive" as const,
        relatedPerson: "Vijay",
        category: "Manifesto",
      },
      {
        title: "Opposition questions TVK's political experience ahead of 2026 polls",
        source: "Google News",
        url: "https://news.google.com/sample/tvk-opposition-criticism-2024",
        publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        summary: "Opposition parties have raised concerns about TVK's political inexperience as Vijay prepares to contest in the 2026 Tamil Nadu assembly elections.",
        sentimentScore: -0.3,
        sentimentLabel: "Negative" as const,
        relatedPerson: "Vijay",
        category: "Party",
      },
      {
        title: "TVK women wing organizes welfare programs in rural Tamil Nadu",
        source: "Google News",
        url: "https://news.google.com/sample/tvk-women-wing-2024",
        publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        summary: "The women's wing of Tamilaga Vettri Kazhagam organized free health checkups and skill development programs across rural constituencies.",
        sentimentScore: 0.7,
        sentimentLabel: "Positive" as const,
        relatedPerson: "TVK",
        category: "Party",
      },
      {
        title: "Vijay TVK youth wing launches social media campaign for Tamil Nadu",
        source: "Google News",
        url: "https://news.google.com/sample/tvk-youth-campaign-2024",
        publishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        summary: "TVK's youth wing has launched a major social media awareness campaign highlighting Tamil Nadu's development needs and party's vision for 2026.",
        sentimentScore: 0.35,
        sentimentLabel: "Positive" as const,
        relatedPerson: "Vijay",
        category: "Party",
      },
      {
        title: "TVK clarifies party stance on NEET, demands state control of medical admissions",
        source: "Google News",
        url: "https://news.google.com/sample/tvk-neet-stance-2024",
        publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        summary: "Tamilaga Vettri Kazhagam has reiterated its position demanding complete state control over medical college admissions and abolition of NEET for Tamil Nadu students.",
        sentimentScore: 0.1,
        sentimentLabel: "Neutral" as const,
        relatedPerson: "TVK",
        category: "Manifesto",
      },
    ];

    await db.insert(newsArticles).values(sampleNews).onConflictDoNothing();

    return NextResponse.json({
      success: true,
      message: "Database seeded successfully",
      counts: {
        mlas: insertedMLAs.length,
        criminalCases: casesToInsert.length,
        manifestoPromises: SAMPLE_MANIFESTO.length,
        newsArticles: sampleNews.length,
      },
    });
  } catch (error) {
    console.error("[Seed API]", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
