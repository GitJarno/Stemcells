// The demo world: a person shipping a small website. Every Cell's words live here.
// CELLS is what seed.sh starts (title, project, first message); TURNS is what agent.mjs plays
// when a message contains `match`. `hold` steps keep a turn open until `go <name>` (rig/go.sh).

export const MODEL = { id: "showcase", name: "Showcase" };

const THEME_OLD = `:root {
  --bg: #ffffff;
  --ink: #16181d;
  --line: #e4e6ea;
}
`;
const THEME_NEW = `${THEME_OLD}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b0d10;
    --ink: #e8eaed;
    --line: #23262c;
  }
}
`;

const FOLLOW_PREVIEW = `  By day         By night
┌───────────┐  ┌───────────┐
│  Website  │  │▓▓Website▓▓│
│  ───────  │  │▓▓───────▓▓│
│  light    │  │▓▓dark▓▓▓▓▓│
└───────────┘  └───────────┘`;
const ALWAYS_PREVIEW = `  By day         By night
┌───────────┐  ┌───────────┐
│▓▓Website▓▓│  │▓▓Website▓▓│
│▓▓───────▓▓│  │▓▓───────▓▓│
│▓▓dark▓▓▓▓▓│  │▓▓dark▓▓▓▓▓│
└───────────┘  └───────────┘`;

const CHART = `\`\`\`chart
bar: Search latency
| Percentile | Before (ms) | After (ms) |
| --- | --- | --- |
| p50 | 120 | 18 |
| p95 | 310 | 45 |
| p99 | 540 | 80 |
\`\`\``;

const WALL = `I measured search before and after the change, over 2,000 queries taken from last week's logs, on the same machine and the same data. Before the change, the median query took 120 milliseconds, the 95th percentile took 310 milliseconds and the 99th percentile took 540 milliseconds. Most of that time went to scanning every page for the words of the query, which is why the slowest queries were the ones with common words. After the change, search reads from an index that is built once at deploy. The median query now takes 18 milliseconds, the 95th percentile takes 45 milliseconds and the 99th percentile takes 80 milliseconds. That is about 6.7 times faster at the median, 6.9 times faster at the 95th percentile and 6.8 times faster at the 99th. The index adds 1.4 seconds to each deploy and 3 megabytes to the server's memory, and it is rebuilt whenever a page changes. Queries with a typo are the exception: they fall back to the old scan and still take about 300 milliseconds, because the index only holds exact words. They are 4 percent of all queries. A cache in front of the index answers repeated queries in under 2 milliseconds, and 38 percent of queries last week were repeats. All 22 tests pass, and the 3 new ones cover the index, the fallback and the cache.`;

const DIAGRAM = `\`\`\`mermaid
flowchart LR
  request([Request]) --> cache{Cache}
  cache -- hit --> result([Result])
  cache -- miss --> index[Index]
  index --> result
\`\`\``;

const passed = (file, count, ms) =>
  ` ✓ ${file} (${count} tests) ${ms}ms\n\n Test Files  1 passed (1)\n      Tests  ${count} passed (${count})`;

/** A short piece of finished work: a read, a check, and a close-out. */
const landed = (match, { read, lead, test, tests, done }) => ({
  match,
  steps: [
    { tool: { kind: "read", title: `Read ${read}`, input: { path: read }, output: "", ms: 200 } },
    {
      tool: {
        kind: "execute",
        title: "pnpm test",
        input: { command: "pnpm test" },
        output: passed(test, tests, 212),
        ms: 300,
      },
    },
    { say: `${lead}\n\n**Done:** ${done}` },
  ],
});

export const CELLS = [
  // Settled by the rig once they land.
  {
    key: "docs-index",
    title: "Docs index",
    project: "Docs",
    message: "Rebuild the docs index so new pages show up in it.",
    settle: true,
  },
  {
    key: "rate-limits",
    title: "Rate limits",
    project: "Website",
    message: "Add rate limits to the public API.",
    settle: true,
  },
  {
    key: "trim-bundle",
    title: "Trim the bundle",
    project: "Website",
    message: "Trim the bundle, the home page loads too much script.",
    settle: true,
  },
  {
    key: "not-found",
    title: "404 page",
    project: "Website",
    message: "Unknown addresses show a blank page. Give them a real 404 page.",
    settle: true,
  },
  // Landed.
  {
    key: "checkout",
    title: "Checkout page",
    project: "Website",
    message: "Build the checkout page: take a card, show the order.",
    lands: true,
  },
  {
    key: "search",
    title: "Speed up search",
    project: "Website",
    message: "Make search faster and show me the numbers.",
    lands: true,
  },
  // In the air: each holds until its name is let go.
  {
    key: "flaky",
    title: "Fix the flaky test",
    project: "Website",
    message: "The cart test fails now and then. Find out why and fix it.",
  },
  {
    key: "images",
    title: "Image sizes",
    project: "Website",
    message: "Make images load at the size they are shown.",
  },
  {
    key: "sitemap",
    title: "Sitemap",
    project: "Docs",
    message: "Generate a sitemap for the docs at build time.",
  },
  // The arc: thrown by shoot.mjs, so its clock is short when the pictures are taken.
  {
    key: "dark",
    title: "Add dark mode",
    project: "Website",
    message: "Add dark mode to the site.",
    late: true,
  },
];

export const TURNS = [
  landed("Rebuild the docs index", {
    read: "docs/index.ts",
    lead: "The index now rebuilds from the pages on disk instead of a list kept by hand.",
    test: "docs/index.test.ts",
    tests: 9,
    done: "new pages show up in the docs index; 9 tests pass.",
  }),
  landed("Add rate limits", {
    read: "src/api/limits.ts",
    lead: "Each key gets 60 requests a minute, and the reply says when to try again.",
    test: "src/api/limits.test.ts",
    tests: 18,
    done: "the public API allows 60 requests a minute per key; 18 tests pass.",
  }),
  landed("Trim the bundle", {
    read: "src/pages/home.ts",
    lead: "The chart library loaded on every page. It loads on the pricing page alone now.",
    test: "src/pages/home.test.ts",
    tests: 11,
    done: "the home page's script is 212 kB, down from 348; 11 tests pass.",
  }),
  landed("a real 404 page", {
    read: "src/pages/router.ts",
    lead: "The router fell through to an empty page. It ends at a 404 page with a way home.",
    test: "src/pages/router.test.ts",
    tests: 6,
    done: "unknown addresses show the 404 page; 6 tests pass.",
  }),
  landed("Build the checkout page", {
    read: "src/pages/checkout.ts",
    lead: "The page takes a card, shows the order and its total, and says so when a card is declined.",
    test: "src/pages/checkout.test.ts",
    tests: 31,
    done: "the checkout page takes a card and shows the order; 31 tests pass.",
  }),
  {
    match: "Make search faster",
    steps: [
      {
        tool: {
          kind: "read",
          title: "Read src/search/query.ts",
          input: { path: "src/search/query.ts" },
          output: "",
          ms: 200,
        },
      },
      {
        write: {
          path: "src/search/index.ts",
          content: "export const index = new Map<string, number[]>();\n",
        },
      },
      {
        tool: {
          kind: "execute",
          title: "pnpm test search",
          input: { command: "pnpm test search" },
          output: passed("src/search/query.test.ts", 22, 340),
          ms: 300,
        },
      },
      {
        say: `Search scanned every page on each query. It reads from an index built at deploy now.\n\n${CHART}\n\n**Done:** search answers in 45 ms at p95, down from 310; 22 tests pass.`,
      },
    ],
  },
  {
    match: "The cart test fails",
    steps: [
      {
        plan: [
          ["Reproduce the failure", "in_progress"],
          ["Find the race", "pending"],
          ["Fix it and run it 50 times", "pending"],
        ],
      },
      {
        tool: {
          kind: "execute",
          title: "pnpm test cart --repeat 40",
          input: { command: "pnpm test cart --repeat 40" },
          output:
            " × src/cart/cart.test.ts > total follows the price\n   expected 24.00, received 0.00\n\n      Tests  35 passed | 5 failed (40)",
          ms: 500,
        },
      },
      {
        plan: [
          ["Reproduce the failure", "completed"],
          ["Find the race", "in_progress"],
          ["Fix it and run it 50 times", "pending"],
        ],
      },
      {
        say: "It fails 5 runs in 40, always on the same line: the test reads the total before the price request has come back.\n\n",
      },
      {
        tool: {
          kind: "read",
          title: "Read src/cart/cart.test.ts",
          input: { path: "src/cart/cart.test.ts" },
          output: "",
          ms: 300,
        },
      },
      {
        plan: [
          ["Reproduce the failure", "completed"],
          ["Find the race", "completed"],
          ["Fix it and run it 50 times", "in_progress"],
        ],
      },
      {
        say: "The test waits a fixed 50 ms for the price. I'm making it wait for the request itself, then running it 50 times to be sure.",
      },
      { hold: "flaky-run" },
      {
        tool: {
          kind: "execute",
          title: "pnpm test cart --repeat 50",
          input: { command: "pnpm test cart --repeat 50" },
          output: "      Tests  50 passed (50)",
          hold: "flaky",
        },
      },
      { say: "\n\n**Done:** the cart test waits for the price request; 50 runs in a row pass." },
    ],
  },
  {
    match: "Make images load at the size",
    steps: [
      {
        tool: {
          kind: "read",
          title: "Read src/pages/gallery.ts",
          input: { path: "src/pages/gallery.ts" },
          output: "",
          ms: 300,
        },
      },
      {
        say: "The gallery sends 2400 px photos into 320 px tiles. I'm adding three widths and letting the browser pick.",
      },
      { hold: "images" },
      { say: "\n\n**Done:** images are served at the size they are shown; 8 tests pass." },
    ],
  },
  {
    match: "Generate a sitemap",
    steps: [
      {
        tool: {
          kind: "read",
          title: "Read docs/build.ts",
          input: { path: "docs/build.ts" },
          output: "",
          ms: 300,
        },
      },
      {
        say: "The build already walks every page, so the sitemap is one more file it writes at the end.",
      },
      { hold: "sitemap" },
      { say: "\n\n**Done:** the docs build writes a sitemap; 5 tests pass." },
    ],
  },
  {
    match: "Add dark mode to the site",
    steps: [
      {
        plan: [
          ["Read the colour tokens", "in_progress"],
          ["Add a dark palette", "pending"],
          ["Run the tests", "pending"],
        ],
      },
      {
        tool: {
          kind: "read",
          title: "Read src/theme.css",
          input: { path: "src/theme.css" },
          output: THEME_OLD,
          ms: 300,
        },
      },
      {
        plan: [
          ["Read the colour tokens", "completed"],
          ["Add a dark palette", "in_progress"],
          ["Run the tests", "pending"],
        ],
      },
      {
        say: "Every colour is a token in `src/theme.css`, so dark mode is one more block of tokens. Adding it now.\n\n",
      },
      { write: { path: "src/theme.css", content: THEME_NEW } },
      {
        tool: {
          kind: "edit",
          title: "Edit src/theme.css",
          input: { path: "src/theme.css" },
          oldText: THEME_OLD,
          newText: THEME_NEW,
          ms: 400,
        },
      },
      {
        plan: [
          ["Read the colour tokens", "completed"],
          ["Add a dark palette", "completed"],
          ["Run the tests", "in_progress"],
        ],
      },
      { hold: "dark-ask" },
      {
        ask: {
          id: "dark_mode",
          header: "Dark mode",
          question: "Follow the system, or always dark?",
          options: [
            {
              label: "Follow the system (Recommended)",
              description: "Light by day, dark when the system is.",
              preview: FOLLOW_PREVIEW,
            },
            {
              label: "Always dark",
              description: "Dark for everyone, whatever the system says.",
              preview: ALWAYS_PREVIEW,
            },
          ],
        },
      },
      {
        tool: {
          kind: "execute",
          title: "pnpm test theme",
          input: { command: "pnpm test theme" },
          output: passed("src/theme.test.ts", 14, 180),
          ms: 500,
        },
      },
      {
        plan: [
          ["Read the colour tokens", "completed"],
          ["Add a dark palette", "completed"],
          ["Run the tests", "completed"],
        ],
      },
      {
        say: "The dark palette switches on when the system does, and the footer has a switch for anyone who wants the other one.\n\n**Done:** dark mode follows the system; 14 tests pass.",
      },
    ],
  },

  // Shown, not told: the same numbers told, then shown. Longer matches first.
  {
    match: "How much faster is search now? Show me",
    steps: [{ say: `Search is about seven times faster at every percentile.\n\n${CHART}` }],
  },
  { match: "How much faster is search now?", steps: [{ say: WALL }] },
  {
    match: "How does a search query travel",
    steps: [
      {
        say: `A repeat is answered from the cache; anything else goes to the index.\n\n${DIAGRAM}`,
      },
    ],
  },
  {
    match: "Ship the search index",
    steps: [
      {
        tool: {
          kind: "read",
          title: "Read config/flags.yml",
          input: { path: "config/flags.yml" },
          output: "",
          ms: 300,
        },
      },
      {
        ask: {
          id: "ship",
          header: "Shipping",
          question: "Ship the index now, or behind a flag?",
          options: [
            {
              label: "Behind a flag (Recommended)",
              description: "On for 10% of visitors first, then everyone.",
              preview: "# config/flags.yml\nsearch-index:\n  on: true\n  share: 10%",
            },
            {
              label: "Ship it now",
              description: "On for everyone with this deploy.",
              preview: "# config/flags.yml\nsearch-index:\n  on: true\n  share: 100%",
            },
          ],
        },
      },
      {
        tool: {
          kind: "execute",
          title: "pnpm test search",
          input: { command: "pnpm test search" },
          output: passed("src/search/query.test.ts", 22, 340),
          ms: 400,
        },
      },
      {
        say: "The index is live behind the `search-index` flag, on for 10% of visitors.\n\n**Done:** search answers in 45 ms at p95, down from 310; 22 tests pass.\n**Left:**\n- waiting: a day of numbers at 10%\n- me: turn the flag on for everyone",
      },
    ],
  },
];

/** The "shown, not told" pictures: each a fresh Cell named Speed up search, one message, one reply. */
export const SHOWN = [
  {
    message: "How much faster is search now?",
    shots: [
      {
        name: "shown-wall",
        until: "the fallback and the cache.",
        note: "The numbers told: one reply, a wall of prose.",
      },
    ],
  },
  {
    message: "How much faster is search now? Show me.",
    shots: [
      {
        name: "shown-chart",
        selector: "[data-stemcells-chart]",
        until: "seven times faster",
        note: "The same numbers shown: a chart fence drawn as a chart, and one sentence.",
      },
    ],
  },
  {
    message: "How does a search query travel now?",
    shots: [
      {
        name: "shown-diagram",
        selector: "[data-markdown-mermaid] svg",
        until: "goes to the index",
        note: "A flow shown: a mermaid fence drawn as a diagram.",
      },
    ],
  },
  {
    message: "Ship the search index.",
    shots: [
      {
        name: "shown-choice",
        asks: true,
        selector: "[data-pending-user-input-toggle]",
        until: "Input requested",
        note: "A choice shown: one question, each option with a preview of what it does.",
      },
      {
        answer: "Behind a flag (Recommended)",
        name: "shown-closeout",
        selector: "[data-stemcells-close-out]",
        until: "turn the flag on for everyone",
        note: "Where it stands, shown: the closing card with its Done line and its Left lines by owner.",
      },
    ],
  },
];
