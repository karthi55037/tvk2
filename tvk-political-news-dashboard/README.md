# TVK Political News Analysis Dashboard

A full-stack political news analysis web application for **Tamilaga Vettri Kazhagam (TVK)** led by **Vijay**, covering Tamil Nadu, India.

---

## 🚀 Features

| Feature | Description |
|---|---|
| 🏠 **Leader Dashboard** | Vijay's profile, sentiment overview, weekly trends, manifesto preview |
| 📰 **Live News Feed** | Auto-fetches RSS every 60s, category & sentiment filters, pagination |
| 👥 **MLA Directory** | Complete MLA profiles with assets, education, criminal case count |
| ⚖️ **Criminal Case Tracker** | Affidavit-only data, district-wise breakdown, case type charts |
| 🗺️ **District FIR Tracker** | Interactive district selector with case details |
| 📋 **Manifesto Tracker** | 12 TVK promises with status, progress bars, and linked news |
| 📊 **Sentiment Analysis** | VADER-inspired rule-based NLP, no paid APIs |
| 🔴 **News Ticker** | Slow-scrolling live ticker at the top |
| 🔄 **Auto-Update** | News components refresh every 60 seconds (no full page reload) |

---

## 🛠 Tech Stack

### Frontend
- **Next.js 15** (App Router, TypeScript)
- **Tailwind CSS v4** — dark professional theme
- **Chart.js + react-chartjs-2** — sentiment, frequency, case charts
- **Axios** — API calls

### Backend (integrated into Next.js API routes)
- **Next.js Route Handlers** — all API endpoints
- **Drizzle ORM** — type-safe PostgreSQL queries
- **PostgreSQL** — local or Supabase
- **rss-parser** — parses public RSS feeds
- **Custom Sentiment Engine** — VADER-inspired rule-based NLP

### Database Tables
- `mlas` — MLA profiles
- `criminal_cases` — declared cases from affidavits
- `news_articles` — fetched & analyzed articles
- `manifesto_promises` — TVK promises with status
- `sentiment_summary` — daily sentiment snapshots

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Leader Dashboard
│   ├── layout.tsx
│   ├── globals.css
│   ├── live-news/page.tsx          # Live News Feed
│   ├── mla-directory/
│   │   ├── page.tsx                # MLA Directory
│   │   └── [id]/page.tsx           # Individual MLA Profile
│   ├── criminal-cases/page.tsx     # Criminal Case Tracker
│   ├── district-fir/page.tsx       # District FIR Tracker
│   ├── manifesto/page.tsx          # Manifesto Tracker
│   └── api/
│       ├── health/route.ts
│       ├── news/route.ts           # GET: paginated news with filters
│       ├── news/fetch/route.ts     # POST: fetch RSS + analyze + store
│       ├── mlas/route.ts           # GET/POST MLAs
│       ├── mlas/[id]/route.ts      # GET MLA profile + cases + news
│       ├── criminal-cases/route.ts # GET/POST criminal cases
│       ├── manifesto/route.ts      # GET/POST/PATCH manifesto
│       ├── sentiment/route.ts      # GET sentiment stats + trends
│       ├── stats/route.ts          # GET dashboard stats
│       └── seed/route.ts           # POST seed sample data
├── components/
│   ├── Sidebar.tsx                 # Navigation sidebar
│   ├── Header.tsx                  # Top header with stats
│   ├── NewsTicker.tsx              # Scrolling news ticker
│   ├── NewsCard.tsx                # News article card
│   └── SentimentChart.tsx          # All Chart.js charts
├── db/
│   ├── index.ts                    # Drizzle + pg connection
│   └── schema.ts                   # All table definitions
└── lib/
    ├── sentiment.ts                # Rule-based sentiment analyzer
    └── rss-fetcher.ts              # RSS parsing utility
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Clone & Install

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit DATABASE_URL with your PostgreSQL connection string
```

### 3. Push Database Schema

```bash
npx drizzle-kit push
```

### 4. Start Development Server

```bash
npm run dev
```

### 5. Load Sample Data

Visit `http://localhost:3000` and click **"Load Sample Data"**, then **"Fetch News"** to pull live RSS articles.

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/news` | Paginated news with filters (category, sentiment, page) |
| POST | `/api/news/fetch` | Fetch RSS feeds → analyze → store |
| GET | `/api/sentiment` | Overall stats + weekly trend + frequency |
| GET | `/api/mlas` | All MLA records |
| GET | `/api/mlas/[id]` | MLA profile + criminal cases + related news |
| GET | `/api/criminal-cases` | All cases with MLA info + district summary |
| POST | `/api/criminal-cases` | Create case record |
| GET | `/api/manifesto` | All manifesto promises |
| POST | `/api/manifesto` | Create promise |
| PATCH | `/api/manifesto` | Update promise status |
| GET | `/api/stats` | Dashboard summary stats |
| POST | `/api/seed` | Seed sample data (idempotent) |

---

## 📡 RSS Sources Used

All sources are **public RSS feeds** — no illegal scraping:

1. `https://news.google.com/rss/search?q=TVK+Vijay+Tamil+Nadu`
2. `https://news.google.com/rss/search?q=Tamilaga+Vettri+Kazhagam`
3. `https://news.google.com/rss/search?q=Vijay+TVK+Tamil+Nadu+politics`
4. `https://news.google.com/rss/search?q=TVK+party+Tamil+Nadu+election`
5. `https://news.google.com/rss/search?q=Vijay+actor+politician+Tamil`

---

## 🔄 Auto-Update System

- **Frontend**: Polls `/api/news`, `/api/sentiment`, `/api/stats` every **60 seconds**
- Only the data components re-render (not full page reload)
- News ticker updates every 60 seconds
- Manual trigger: "Fetch News" button in header

### To set up a backend scheduler (for production):

```bash
# Using cron (Linux/Mac) — fetch every 10 minutes
*/10 * * * * curl -X POST https://your-domain.com/api/news/fetch
```

Or use Vercel Cron Jobs (free tier):

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/news/fetch",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

---

## 🎨 Design System

| Color | Use |
|---|---|
| `#C8102E` | TVK Red — primary, active states, accents |
| `#FFD700` | TVK Yellow — party logo, highlights |
| `#030712` | Dark background |
| `#111827` | Card background |
| `#10b981` | Positive sentiment |
| `#ef4444` | Negative sentiment / criminal cases |
| `#6b7280` | Neutral sentiment |

---

## ⚖️ Ethics & Legal Compliance

- ✅ **Only free public RSS feeds** — no illegal scraping
- ✅ **No copyrighted images** — Wikimedia Commons only
- ✅ **Criminal case data** — only officially declared ECI affidavits
- ✅ **No unverified allegations** — all data clearly sourced
- ✅ **Acquitted cases clearly marked** — no false implications
- ✅ **Legal disclaimer** displayed on criminal case pages
- ✅ **Ethical political reporting** — factual, neutral presentation

---

## 🚀 Deployment

### Frontend + API (Vercel Free Tier)
```bash
vercel deploy
```

### Database (Supabase Free Tier)
1. Create project at supabase.com
2. Copy connection string
3. Update `DATABASE_URL` in environment variables
4. Run `npx drizzle-kit push`

### Environment Variables for Vercel
```
DATABASE_URL=postgresql://...your-supabase-url...
```

---

## 📝 License

This project is for educational and research purposes. All political data displayed is from public sources. The application does not endorse any political party.
