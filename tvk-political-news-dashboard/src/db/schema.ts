import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";

// ── MLAs Table ────────────────────────────────────────────────────────────────
export const mlas = pgTable("mlas", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  constituency: varchar("constituency", { length: 255 }).notNull(),
  district: varchar("district", { length: 255 }).notNull(),
  party: varchar("party", { length: 255 }).notNull().default("TVK"),
  photoUrl: text("photo_url"),
  education: text("education"),
  assets: text("assets"),
  liabilities: text("liabilities"),
  criminalCaseCount: integer("criminal_case_count").notNull().default(0),
  affidavitLink: text("affidavit_link"),
  designation: varchar("designation", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  bio: text("bio"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Criminal Cases Table ──────────────────────────────────────────────────────
export const criminalCases = pgTable("criminal_cases", {
  id: serial("id").primaryKey(),
  mlaId: integer("mla_id")
    .notNull()
    .references(() => mlas.id, { onDelete: "cascade" }),
  caseType: varchar("case_type", { length: 100 }).notNull(), // Corruption | Assault | Financial | Other
  ipcSections: text("ipc_sections"),
  courtName: varchar("court_name", { length: 255 }),
  district: varchar("district", { length: 255 }),
  year: integer("year"),
  status: varchar("status", { length: 100 }).notNull().default("Pending"), // Pending | Acquitted | Convicted | Withdrawn
  description: text("description"),
  sourceReference: text("source_reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── News Articles Table ───────────────────────────────────────────────────────
export const newsArticles = pgTable("news_articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  source: varchar("source", { length: 255 }),
  url: text("url").notNull().unique(),
  imageUrl: text("image_url"),
  publishedAt: timestamp("published_at"),
  summary: text("summary"),
  content: text("content"),
  sentimentScore: real("sentiment_score").notNull().default(0),
  sentimentLabel: varchar("sentiment_label", { length: 50 }).notNull().default("Neutral"), // Positive | Neutral | Negative
  relatedPerson: varchar("related_person", { length: 255 }),
  category: varchar("category", { length: 100 }).default("General"), // Leader | Party | MLA | Criminal | Manifesto
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
});

// ── Manifesto Promises Table ──────────────────────────────────────────────────
export const manifestoPromises = pgTable("manifesto_promises", {
  id: serial("id").primaryKey(),
  promise: text("promise").notNull(),
  category: varchar("category", { length: 100 }).notNull().default("General"),
  status: varchar("status", { length: 50 }).notNull().default("Announced"), // Announced | InProgress | Completed | NoUpdate
  progressPercent: integer("progress_percent").notNull().default(0),
  details: text("details"),
  targetDate: varchar("target_date", { length: 100 }),
  relatedNewsIds: text("related_news_ids"), // comma-separated IDs
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Sentiment Summary Table (daily snapshots) ─────────────────────────────────
export const sentimentSummary = pgTable("sentiment_summary", {
  id: serial("id").primaryKey(),
  date: varchar("date", { length: 20 }).notNull().unique(), // YYYY-MM-DD
  positiveCount: integer("positive_count").notNull().default(0),
  neutralCount: integer("neutral_count").notNull().default(0),
  negativeCount: integer("negative_count").notNull().default(0),
  totalArticles: integer("total_articles").notNull().default(0),
  avgSentimentScore: real("avg_sentiment_score").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Type Exports ──────────────────────────────────────────────────────────────
export type MLA = typeof mlas.$inferSelect;
export type InsertMLA = typeof mlas.$inferInsert;
export type CriminalCase = typeof criminalCases.$inferSelect;
export type InsertCriminalCase = typeof criminalCases.$inferInsert;
export type NewsArticle = typeof newsArticles.$inferSelect;
export type InsertNewsArticle = typeof newsArticles.$inferInsert;
export type ManifestoPromise = typeof manifestoPromises.$inferSelect;
export type InsertManifestoPromise = typeof manifestoPromises.$inferInsert;
export type SentimentSummary = typeof sentimentSummary.$inferSelect;
