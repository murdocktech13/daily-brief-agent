/**
 * Daily Brief Agent
 * ─────────────────
 * Runs on a schedule (via GitHub Actions), fetches AI news, asks Claude
 * to distil the 3 most important stories into a punchy brief, and saves
 * the result as a new page in Notion.
 *
 * Five stages:
 *  1. WAKE UP  — bootstrap config & announce start
 *  2. READ     — pull the top 15 headlines from the RSS feed
 *  3. THINK    — send headlines to Claude, get back a polished brief
 *  4. SAVE     — create a Notion page with today's date as the title
 *  5. NOTIFY   — print the brief clearly to stdout
 */

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { Client as NotionClient } from "@notionhq/client";
import RSSParser from "rss-parser";

// ─── Easy-to-change config ───────────────────────────────────────────────────

const RSS_FEED_URL =
  "https://news.google.com/rss/search?q=artificial+intelligence";

const CLAUDE_MODEL = "claude-sonnet-4-6";

const HEADLINES_TO_FETCH = 15;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Headline {
  title: string;
  link: string;
  pubDate: string;
}

// ─── Helper: validate env vars upfront ───────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}\n` +
        `Copy .env.example → .env and fill in your keys.`
    );
  }
  return value;
}

// ─── Stage 2: READ ───────────────────────────────────────────────────────────

async function fetchHeadlines(): Promise<Headline[]> {
  console.log(`\n📰 [READ] Fetching headlines from:\n   ${RSS_FEED_URL}\n`);

  const parser = new RSSParser();
  const feed = await parser.parseURL(RSS_FEED_URL);

  const headlines = (feed.items ?? [])
    .slice(0, HEADLINES_TO_FETCH)
    .map((item) => ({
      title: item.title ?? "(no title)",
      link: item.link ?? "",
      pubDate: item.pubDate ?? "",
    }));

  console.log(`   Found ${headlines.length} headlines:`);
  headlines.forEach((h, i) => console.log(`   ${i + 1}. ${h.title}`));

  return headlines;
}

// ─── Stage 3: THINK ──────────────────────────────────────────────────────────

async function generateBrief(
  headlines: Headline[],
  anthropic: Anthropic
): Promise<string> {
  console.log(`\n🤔 [THINK] Sending headlines to Claude (${CLAUDE_MODEL})…\n`);

  const headlineList = headlines
    .map((h, i) => `${i + 1}. ${h.title}`)
    .join("\n");

  const prompt = `You are a sharp, encouraging editor who writes daily AI news briefs for busy professionals.

Here are today's top ${headlines.length} AI headlines:

${headlineList}

Your job:
1. Pick the 3 most important or interesting stories.
2. Write a short, punchy brief — 3 paragraphs, one per story.
   - Lead with the most important story.
   - Use a direct, encouraging voice. Be energising, not alarming.
   - Each paragraph: 2–3 sentences max.
3. End with a single "Today's action" — one concrete thing the reader could do today based on this news (start with a verb, keep it under 20 words).

Format your response exactly like this:

**Daily AI Brief — [Today's Date]**

[Paragraph 1 about story 1]

[Paragraph 2 about story 2]

[Paragraph 3 about story 3]

**Today's action:** [One-sentence action]`;

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const brief = message.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("\n");

  return brief;
}

// ─── Stage 4: SAVE ───────────────────────────────────────────────────────────

async function saveToNotion(
  brief: string,
  notion: NotionClient,
  databaseId: string
): Promise<string> {
  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
  const title = `Daily AI Brief — ${today}`;

  console.log(`\n💾 [SAVE] Creating Notion page: "${title}"…\n`);

  // Split the brief into paragraphs so each becomes its own Notion block
  const paragraphs = brief
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const richTextBlocks = paragraphs.map((paragraph) => ({
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: [
        {
          type: "text" as const,
          text: { content: paragraph },
        },
      ],
    },
  }));

  const response = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      // "Name" or "Title" is the default title property in Notion databases
      Name: {
        title: [{ text: { content: title } }],
      },
      // Status property — your database must have a "Status" select property
      Status: {
        select: { name: "Pending" },
      },
    },
    children: richTextBlocks,
  });

  const pageUrl =
    "url" in response
      ? (response as unknown as { url: string }).url
      : "https://notion.so";

  console.log(`   ✅ Notion page created!`);
  console.log(`   🔗 ${pageUrl}`);

  return pageUrl;
}

// ─── Stage 5: NOTIFY ─────────────────────────────────────────────────────────

function notify(brief: string, notionUrl: string): void {
  console.log("\n" + "═".repeat(60));
  console.log("📬 [NOTIFY] Today's brief is ready!");
  console.log("═".repeat(60));
  console.log("\n" + brief + "\n");
  console.log("─".repeat(60));
  console.log(`📎 Notion page: ${notionUrl}`);
  console.log("─".repeat(60) + "\n");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // ── Stage 1: WAKE UP ──────────────────────────────────────────────────────
  console.log("═".repeat(60));
  console.log("🌅 [WAKE UP] Daily Brief Agent starting…");
  console.log(`   ${new Date().toUTCString()}`);
  console.log("═".repeat(60));

  // Validate all required env vars before doing any network calls
  const anthropicKey = requireEnv("ANTHROPIC_API_KEY");
  const notionToken = requireEnv("NOTION_TOKEN");
  const notionDatabaseId = requireEnv("NOTION_DATABASE_ID");

  // Initialise clients
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const notion = new NotionClient({ auth: notionToken });

  try {
    // ── Stage 2: READ ────────────────────────────────────────────────────
    const headlines = await fetchHeadlines();

    if (headlines.length === 0) {
      throw new Error("No headlines found — the RSS feed may be unavailable.");
    }

    // ── Stage 3: THINK ───────────────────────────────────────────────────
    const brief = await generateBrief(headlines, anthropic);

    // ── Stage 4: SAVE ────────────────────────────────────────────────────
    const notionUrl = await saveToNotion(brief, notion, notionDatabaseId);

    // ── Stage 5: NOTIFY ──────────────────────────────────────────────────
    notify(brief, notionUrl);

    console.log("✅ Agent finished successfully.\n");
  } catch (error) {
    console.error("\n❌ Agent encountered an error:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
