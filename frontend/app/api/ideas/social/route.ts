import { NextResponse } from "next/server";

/**
 * GET /api/ideas/social — Fetch trending tickers from Reddit (r/wallstreetbets, r/stocks, r/investing).
 *
 * Parses post titles for $TICKER or all-caps ticker mentions, counts frequency,
 * and returns ranked list with sentiment snippets.
 *
 * Uses Reddit's public JSON API (no auth needed, just a User-Agent header).
 */

interface RedditPost {
  title: string;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  created_utc: number;
  subreddit: string;
  selftext: string;
  link_flair_text: string | null;
}

interface SocialTicker {
  ticker: string;
  mentions: number;
  totalScore: number;
  topPosts: {
    title: string;
    subreddit: string;
    score: number;
    comments: number;
    url: string;
    flair: string | null;
    hoursAgo: number;
  }[];
  sentiment: "bullish" | "bearish" | "mixed";
}

// Common words that look like tickers but aren't
const TICKER_BLOCKLIST = new Set([
  "A", "I", "AM", "AN", "AS", "AT", "BE", "BY", "DO", "GO", "HE", "IF",
  "IN", "IS", "IT", "ME", "MY", "NO", "OF", "OK", "ON", "OR", "SO", "TO",
  "UP", "US", "WE", "CEO", "CFO", "CTO", "IPO", "SEC", "GDP", "ATH", "ATL",
  "DD", "IMO", "FYI", "PSA", "TIL", "ELI", "LOL", "OMG", "WTF", "RIP",
  "FOR", "THE", "AND", "BUT", "NOT", "YOU", "ALL", "CAN", "HAS", "HER",
  "WAS", "ONE", "OUR", "OUT", "DAY", "HAD", "HOT", "OLD", "RED", "NEW",
  "NOW", "WAY", "WHO", "BOT", "BIG", "TOP", "LOW", "HIGH", "HOLD", "HODL",
  "YOLO", "FOMO", "DYOR", "PUMP", "DUMP", "MOON", "PUTS", "CALL", "LONG",
  "SHORT", "BULL", "BEAR", "GAIN", "LOSS", "SELL", "BOUGHT", "SOLD",
  "ETF", "IRA", "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CNY",
  "AI", "EV", "PE", "PS", "PB", "ROE", "ROI", "YOY", "QOQ", "MOM",
  "USA", "UK", "EU", "FED", "IMF", "GDP", "CPI", "PPI", "NFP",
  "EDIT", "POST", "JUST", "LIKE", "THIS", "THAT", "WITH", "FROM",
  "WHAT", "WHEN", "WILL", "HAVE", "BEEN", "SOME", "THAN", "THEM",
  "THEN", "ONLY", "OVER", "SUCH", "TAKE", "INTO", "YEAR", "YOUR",
  "COME", "MAKE", "VERY", "MOST", "MUCH", "ALSO", "BACK", "EVEN",
  "GOOD", "GIVE", "MANY", "WELL", "STILL", "DOWN", "SHOULD", "COULD",
  "WOULD", "ABOUT", "AFTER", "THINK", "GOING", "EVERY", "GREAT",
  "STOCK", "MONEY", "PRICE", "SHARE", "TRADE", "VALUE",
  "THINK", "THESE", "THOSE", "THEIR", "THERE", "WHICH", "WHERE",
  "MARKET", "INVEST", "TRADER", "OPTION", "FUTURE",
]);

// Known valid tickers that might be short
const KNOWN_TICKERS = new Set([
  "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA",
  "AMD", "INTC", "NFLX", "PYPL", "SQ", "SHOP", "UBER", "LYFT",
  "PLTR", "SOFI", "RIVN", "LCID", "NIO", "BABA", "JD", "PDD",
  "SPY", "QQQ", "DIA", "IWM", "VTI", "VOO", "ARKK",
  "GME", "AMC", "BB", "BBBY", "WISH", "CLOV", "CLNE",
  "COIN", "MSTR", "MARA", "RIOT", "HOOD", "RBLX", "SNAP",
  "BA", "GE", "F", "GM", "T", "VZ", "WMT", "TGT", "COST",
  "JPM", "BAC", "GS", "MS", "WFC", "C", "V", "MA",
  "JNJ", "PFE", "MRNA", "ABBV", "LLY", "UNH", "BMY",
  "XOM", "CVX", "COP", "OXY", "SLB", "HAL",
  "DIS", "CMCSA", "PARA", "WBD", "SPOT",
  "CRM", "ORCL", "NOW", "SNOW", "DDOG", "NET", "ZS",
  "TSM", "AVGO", "QCOM", "MU", "LRCX", "AMAT", "KLAC",
  "LMT", "RTX", "NOC", "GD", "HII",
  "SMCI", "ARM", "CRWD", "PANW", "FTNT",
]);

function extractTickers(text: string): string[] {
  const tickers: string[] = [];

  // Match $TICKER pattern
  const dollarPattern = /\$([A-Z]{1,5})\b/g;
  let match;
  while ((match = dollarPattern.exec(text)) !== null) {
    const t = match[1];
    if (!TICKER_BLOCKLIST.has(t)) tickers.push(t);
  }

  // Match standalone uppercase words (2-5 chars) that look like tickers
  const wordPattern = /\b([A-Z]{2,5})\b/g;
  while ((match = wordPattern.exec(text)) !== null) {
    const t = match[1];
    if (!TICKER_BLOCKLIST.has(t) && KNOWN_TICKERS.has(t) && !tickers.includes(t)) {
      tickers.push(t);
    }
  }

  return tickers;
}

function guessSentiment(text: string): "bullish" | "bearish" | "mixed" {
  const lower = text.toLowerCase();
  const bullWords = ["buy", "calls", "moon", "bullish", "long", "undervalued", "squeeze", "breakout", "rocket", "gain", "up", "green", "bull"];
  const bearWords = ["sell", "puts", "crash", "bearish", "short", "overvalued", "dump", "drop", "down", "red", "bear", "loss"];

  let bull = 0, bear = 0;
  for (const w of bullWords) if (lower.includes(w)) bull++;
  for (const w of bearWords) if (lower.includes(w)) bear++;

  if (bull > bear + 1) return "bullish";
  if (bear > bull + 1) return "bearish";
  return "mixed";
}

async function fetchSubreddit(subreddit: string, sort: string = "hot"): Promise<RedditPost[]> {
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=50&t=day`,
      {
        headers: {
          "User-Agent": "NextGenStock/1.0 (trading research bot)",
        },
        next: { revalidate: 300 }, // Cache 5 minutes
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const posts: RedditPost[] = (data?.data?.children ?? []).map(
      (child: { data: RedditPost }) => ({
        title: child.data.title,
        score: child.data.score,
        num_comments: child.data.num_comments,
        url: child.data.url,
        permalink: child.data.permalink,
        created_utc: child.data.created_utc,
        subreddit: child.data.subreddit,
        selftext: (child.data.selftext ?? "").slice(0, 500),
        link_flair_text: child.data.link_flair_text,
      })
    );

    return posts;
  } catch {
    return [];
  }
}

export async function GET() {
  const nowSec = Date.now() / 1000;

  // Fetch from multiple subreddits in parallel
  const [wsb, stocks, investing] = await Promise.all([
    fetchSubreddit("wallstreetbets", "hot"),
    fetchSubreddit("stocks", "hot"),
    fetchSubreddit("investing", "hot"),
  ]);

  const allPosts = [...wsb, ...stocks, ...investing];

  // Extract tickers and aggregate
  const tickerMap = new Map<string, {
    mentions: number;
    totalScore: number;
    posts: typeof allPosts;
    texts: string[];
  }>();

  for (const post of allPosts) {
    const fullText = `${post.title} ${post.selftext}`;
    const tickers = extractTickers(fullText);

    for (const ticker of tickers) {
      const entry = tickerMap.get(ticker) ?? {
        mentions: 0,
        totalScore: 0,
        posts: [],
        texts: [],
      };
      entry.mentions++;
      entry.totalScore += post.score;
      entry.posts.push(post);
      entry.texts.push(fullText);
      tickerMap.set(ticker, entry);
    }
  }

  // Build ranked results (min 2 mentions to filter noise)
  const results: SocialTicker[] = [];

  for (const [ticker, data] of tickerMap) {
    if (data.mentions < 2) continue;

    const combinedText = data.texts.join(" ");
    const topPosts = data.posts
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((p) => ({
        title: p.title.slice(0, 120),
        subreddit: p.subreddit,
        score: p.score,
        comments: p.num_comments,
        url: `https://reddit.com${p.permalink}`,
        flair: p.link_flair_text,
        hoursAgo: Math.round((nowSec - p.created_utc) / 3600),
      }));

    results.push({
      ticker,
      mentions: data.mentions,
      totalScore: data.totalScore,
      topPosts,
      sentiment: guessSentiment(combinedText),
    });
  }

  // Sort by mentions desc, then by totalScore desc
  results.sort((a, b) => {
    if (a.mentions !== b.mentions) return b.mentions - a.mentions;
    return b.totalScore - a.totalScore;
  });

  return NextResponse.json({
    tickers: results.slice(0, 20),
    sources: ["r/wallstreetbets", "r/stocks", "r/investing"],
    postsScanned: allPosts.length,
    fetchedAt: new Date().toISOString(),
  });
}
