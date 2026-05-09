/**
 * Sentiment Analysis Utility
 * Uses a rule-based VADER-inspired approach for Tamil Nadu political news.
 * Completely free, no external API calls.
 */

// Positive political keywords relevant to TVK / Tamil Nadu politics
const POSITIVE_WORDS = new Set([
  "win", "won", "victory", "victorious", "success", "successful", "development",
  "progress", "growth", "achieve", "achievement", "launch", "inaugurate",
  "support", "rally", "massive", "huge", "popular", "welfare", "benefit",
  "scheme", "announce", "promise", "fulfill", "complete", "good", "great",
  "excellent", "outstanding", "positive", "praise", "appreciate", "welcome",
  "celebrate", "celebration", "congratulate", "encourage", "improve",
  "improvement", "boost", "increase", "rise", "help", "aid", "assist",
  "relief", "donation", "service", "dedication", "commitment", "trust",
  "hope", "proud", "pride", "honor", "award", "recognition",
  "vijay", "tvk", "tamilaga", "vettri", "kazhagam", "leader", "strength",
]);

// Negative political keywords
const NEGATIVE_WORDS = new Set([
  "arrest", "arrested", "accused", "case", "fir", "charges", "allegation",
  "corruption", "scam", "fraud", "bribe", "controversy", "crisis", "conflict",
  "protest", "oppose", "opposition", "attack", "violence", "riot", "clash",
  "fail", "failure", "defeat", "loss", "lost", "reject", "rejected",
  "criticism", "criticize", "condemn", "condemned", "ban", "banned",
  "suspend", "suspended", "expelled", "dismiss", "dismissed", "resign",
  "resignation", "scandal", "illegal", "unlawful", "crime", "criminal",
  "death", "died", "killed", "murder", "assault", "drug", "bomb",
  "threat", "terror", "fake", "false", "lie", "liar", "corrupt",
  "problem", "issue", "trouble", "concern", "worry", "fear", "danger",
  "poor", "bad", "worst", "terrible", "horrible", "disaster",
]);

// Tamil political stop words (transliterated) — treated as neutral
const NEUTRAL_WORDS = new Set([
  "said", "says", "stated", "announced", "held", "meeting", "party",
  "election", "vote", "seat", "constituency", "district", "minister",
  "government", "assembly", "parliament", "political", "politician",
  "press", "conference", "interview", "media", "news", "report",
]);

export interface SentimentResult {
  score: number;       // -1.0 to +1.0
  label: "Positive" | "Neutral" | "Negative";
  positiveWords: string[];
  negativeWords: string[];
}

/**
 * Analyze sentiment of a text string.
 * Returns score in range [-1, 1] and label.
 */
export function analyzeSentiment(text: string): SentimentResult {
  if (!text || text.trim().length === 0) {
    return { score: 0, label: "Neutral", positiveWords: [], negativeWords: [] };
  }

  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  let positiveCount = 0;
  let negativeCount = 0;
  const positiveWords: string[] = [];
  const negativeWords: string[] = [];

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) {
      positiveCount++;
      if (!positiveWords.includes(word)) positiveWords.push(word);
    } else if (NEGATIVE_WORDS.has(word)) {
      negativeCount++;
      if (!negativeWords.includes(word)) negativeWords.push(word);
    }
  }

  const total = positiveCount + negativeCount;
  let score = 0;

  if (total > 0) {
    score = (positiveCount - negativeCount) / total;
    // Normalize slightly to avoid extreme scores on short texts
    const wordCount = words.length;
    const dampening = Math.min(1, Math.log(wordCount + 1) / Math.log(50));
    score = score * dampening;
  }

  // Clamp to [-1, 1]
  score = Math.max(-1, Math.min(1, score));

  let label: "Positive" | "Neutral" | "Negative";
  if (score > 0.05) {
    label = "Positive";
  } else if (score < -0.05) {
    label = "Negative";
  } else {
    label = "Neutral";
  }

  return { score, label, positiveWords, negativeWords };
}
