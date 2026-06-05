# 🌅 Daily Brief Agent

An autonomous agent that runs every weekday morning, reads the latest AI news, asks Claude to distil it into a punchy 3-story brief, and saves the result to Notion — all for free on GitHub Actions.

---

## What it does (in order)

1. **WAKE UP** — GitHub Actions triggers the agent on a schedule
2. **READ** — Fetches the top 15 headlines from a Google News RSS feed
3. **THINK** — Sends the headlines to Claude, which picks the 3 most important stories and writes a short, direct brief with a suggested action
4. **SAVE** — Creates a new page in your Notion database (title = today's date, Status = "Pending")
5. **NOTIFY** — Prints the brief clearly to the Actions log so you can see it worked

---

## Prerequisites

You need accounts (all free) at:
- [GitHub](https://github.com) — to host the code and run the schedule
- [Anthropic](https://console.anthropic.com) — for the Claude API key
- [Notion](https://notion.so) — to store the briefs

---

## Step-by-step setup

### Step 1 — Get your API keys

#### Anthropic API key
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / log in
3. Click **API Keys** in the left sidebar
4. Click **Create Key**, name it "Daily Brief Agent", copy the key
5. Keep it somewhere safe — you won't see it again

#### Notion Integration Token
1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **+ New integration**
3. Name it "Daily Brief Agent", choose your workspace, click **Submit**
4. Copy the **Internal Integration Token** (starts with `secret_`)

### Step 2 — Create your Notion database

1. In Notion, create a new **full-page database** (Table view)
2. Make sure it has these two properties (they're created by default):
   - **Name** (title property — already exists)
   - **Status** (Select type — add options: "Pending", "Done")
3. Share the database with your integration:
   - Open the database → click **…** (top right) → **Add connections**
   - Search for "Daily Brief Agent" and click **Confirm**
4. Copy the database ID from the URL:
   - The URL looks like: `https://notion.so/yourworkspace/`**`abc123def456ghi789jkl012mno345pq`**`?v=...`
   - The bold part (32 characters before the `?`) is your database ID

### Step 3 — Set up the project locally

```bash
# Clone your fork / download the project
git clone https://github.com/YOUR_USERNAME/daily-brief-agent
cd daily-brief-agent

# Install dependencies
npm install

# Create your .env file from the template
cp .env.example .env
```

Open `.env` in any text editor and fill in your three keys:

```
ANTHROPIC_API_KEY=sk-ant-...
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=abc123def456...
```

### Step 4 — Test it locally

```bash
npm start
```

You should see the agent wake up, fetch headlines, print the brief, and confirm a Notion page was created. Check your Notion database — the new page should be there!

### Step 5 — Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

> ⚠️ Make sure `.env` is in your `.gitignore` (it is by default). Never commit real API keys.

### Step 6 — Add secrets to GitHub Actions

Your API keys need to be available to GitHub Actions as **encrypted secrets**:

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add each of these:

| Secret name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `NOTION_TOKEN` | Your Notion integration token |
| `NOTION_DATABASE_ID` | Your Notion database ID |

### Step 7 — Test the GitHub Actions workflow

1. Go to your repo → **Actions** tab
2. Click **Daily Brief Agent** in the left sidebar
3. Click **Run workflow** → **Run workflow** (green button)
4. Watch the run — it should complete in under a minute with a green ✅

### Step 8 — Enjoy your daily brief!

The workflow runs automatically **every weekday at 7:00 AM UTC**. To change the time, edit `.github/workflows/daily-brief.yml` and update the cron line:

```yaml
- cron: "0 7 * * 1-5"   # minute  hour  *  *  Mon-Fri
#           ↑ change this to your preferred UTC hour
```

---

## Customisation

| What to change | Where |
|---|---|
| News topic / RSS feed | `agent.ts` — `RSS_FEED_URL` at the top |
| Number of headlines to fetch | `agent.ts` — `HEADLINES_TO_FETCH` |
| Claude model | `agent.ts` — `CLAUDE_MODEL` |
| Brief tone / format | `agent.ts` — the prompt inside `generateBrief()` |
| Schedule | `.github/workflows/daily-brief.yml` — the `cron:` line |

---

## Project structure

```
daily-brief-agent/
├── agent.ts                        # The agent — all logic lives here
├── package.json
├── tsconfig.json
├── .env.example                    # Template for your keys (safe to commit)
├── .env                            # Your real keys (gitignored)
├── .gitignore
├── README.md
└── .github/
    └── workflows/
        └── daily-brief.yml         # GitHub Actions schedule
```

---

## Troubleshooting

**"Missing environment variable"** — Make sure your `.env` file exists and has all three keys filled in. Locally, run `cat .env` to check.

**Notion page not created** — Confirm you've shared the database with your integration (Step 2, point 3 above). The integration must have access to the exact database.

**"Status" property error** — Make sure your Notion database has a **Select** property named exactly `Status` with an option called `Pending`.

**GitHub Actions not running** — Check the **Actions** tab. If workflows are disabled, click **Enable workflows**. New repos sometimes need this.

---

## Cost

- **GitHub Actions**: free on public repos; 2,000 min/month free on private repos (this job uses ~1 min/run)
- **Anthropic API**: ~$0.003 per run with claude-sonnet-4-6 (very cheap)
- **Notion**: free plan is fine
