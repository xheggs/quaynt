/**
 * One-off benchmark: measures the throughput cost of the AI-referrer
 * classification added to the crawler parse loop in PRP 6.2b.
 *
 * Generates a 1M-line synthetic Apache log and runs the per-line pipeline twice:
 *   1. "baseline" — identifyBot() only (simulates pre-6.2b behavior).
 *   2. "withAi"   — identifyBot() + classifyLogLineForAiSource() (post-6.2b).
 *
 * Reports lines/sec for each and the delta. The 6.2b validation gate requires
 * the delta to stay within 15%.
 *
 * Run with: `npx tsx scripts/bench-crawler-parse.ts`
 *
 * Not wired into npm scripts or CI — this is evidence-gathering, not a
 * regression test.
 */

import { parseApacheLine } from '../src/modules/crawler/crawler-log-parser';
import { identifyBot } from '../src/modules/crawler/crawler-bot-dictionary';
import { classifyLogLineForAiSource } from '../src/modules/crawler/crawler-referrer-classifier';

const LINE_COUNT = 1_000_000;

const BOT_UAS = [
  'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)',
  'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
];
const HUMAN_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:118.0) Gecko/20100101 Firefox/118.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
];
const AI_REFERRERS = [
  'https://chatgpt.com/c/abc-123-def',
  'https://www.perplexity.ai/search/foo',
  'https://gemini.google.com/app/home',
  'https://claude.ai/chat/xyz',
  'https://copilot.microsoft.com/chat',
];
const NON_AI_REFERRERS = [
  'https://google.com/search?q=something',
  'https://news.ycombinator.com/item?id=1',
  'https://www.bing.com/search?q=foo',
  'https://duckduckgo.com/?q=bar',
];

type Composition = {
  botRatio: number; // fraction of lines that are bot crawls
  aiRatio: number; // fraction of lines that are AI-referred humans
  malformedRatio: number; // fraction of lines that are garbage
  // remainder: non-AI humans
};

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function randomByte(i: number): number {
  // Deterministic pseudo-random for reproducibility
  return ((i * 2654435761) >>> 0) & 0xff;
}

function generateLines(count: number, composition: Composition): string[] {
  const out: string[] = new Array(count);
  const botBoundary = Math.floor(count * composition.botRatio);
  const aiBoundary = botBoundary + Math.floor(count * composition.aiRatio);
  const malformedBoundary = aiBoundary + Math.floor(count * composition.malformedRatio);

  for (let i = 0; i < count; i++) {
    // Shuffle category assignment by index bits so categories interleave, not block.
    const bucket = ((i * 2654435761) >>> 0) % count;
    const isBot = bucket < botBoundary;
    const isAi = !isBot && bucket < aiBoundary;
    const isMalformed = !isBot && !isAi && bucket < malformedBoundary;

    if (isMalformed) {
      out[i] = 'this line is malformed nonsense';
      continue;
    }

    const day = 1 + (i % 28);
    const hour = (i * 7) % 24;
    const minute = (i * 13) % 60;
    const second = (i * 17) % 60;
    const timestamp = `${day.toString().padStart(2, '0')}/Oct/2025:${hour
      .toString()
      .padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second
      .toString()
      .padStart(2, '0')} +0000`;
    const ip = `${randomByte(i)}.${randomByte(i + 1)}.${randomByte(i + 2)}.${randomByte(i + 3)}`;
    const path = `/page/${i % 10_000}`;

    if (isBot) {
      const ua = pick(BOT_UAS, i);
      out[i] = `${ip} - - [${timestamp}] "GET ${path} HTTP/1.1" 200 1024 "-" "${ua}"`;
    } else if (isAi) {
      const ua = pick(HUMAN_UAS, i);
      const ref = pick(AI_REFERRERS, i);
      out[i] = `${ip} - - [${timestamp}] "GET ${path} HTTP/1.1" 200 2048 "${ref}" "${ua}"`;
    } else {
      const ua = pick(HUMAN_UAS, i);
      // 60% of non-AI humans have a referrer at all
      const ref = i % 5 < 3 ? pick(NON_AI_REFERRERS, i) : '-';
      out[i] = `${ip} - - [${timestamp}] "GET ${path} HTTP/1.1" 200 4096 "${ref}" "${ua}"`;
    }
  }

  return out;
}

type Stats = {
  elapsedMs: number;
  linesPerSec: number;
  bots: number;
  aiVisits: number;
  malformed: number;
};

function runBaseline(lines: string[]): Stats {
  let bots = 0;
  let malformed = 0;
  const start = performance.now();
  for (const line of lines) {
    const parsed = parseApacheLine(line);
    if (!parsed) {
      malformed++;
      continue;
    }
    if (identifyBot(parsed.userAgent)) bots++;
  }
  const elapsedMs = performance.now() - start;
  return {
    elapsedMs,
    linesPerSec: (lines.length / elapsedMs) * 1000,
    bots,
    aiVisits: 0,
    malformed,
  };
}

function runWithAi(lines: string[]): Stats {
  let bots = 0;
  let aiVisits = 0;
  let malformed = 0;
  const start = performance.now();
  for (const line of lines) {
    const parsed = parseApacheLine(line);
    if (!parsed) {
      malformed++;
      continue;
    }
    if (identifyBot(parsed.userAgent)) {
      bots++;
      continue;
    }
    if (classifyLogLineForAiSource(parsed)) {
      aiVisits++;
    }
  }
  const elapsedMs = performance.now() - start;
  return {
    elapsedMs,
    linesPerSec: (lines.length / elapsedMs) * 1000,
    bots,
    aiVisits,
    malformed,
  };
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

async function main() {
  console.log(`Generating ${fmt(LINE_COUNT)} synthetic Apache lines...`);
  const lines = generateLines(LINE_COUNT, {
    botRatio: 0.4,
    aiRatio: 0.15,
    malformedRatio: 0.05,
  });
  console.log(`  first line: ${lines[0]}`);
  console.log(`  random AI-ref line: ${lines.find((l) => l.includes('chatgpt.com'))}`);

  // Warm the JIT
  console.log('Warming up (100k lines each pipeline)...');
  runBaseline(lines.slice(0, 100_000));
  runWithAi(lines.slice(0, 100_000));

  console.log('Running baseline (identifyBot only)...');
  const baseline = runBaseline(lines);
  console.log(
    `  ${fmt(baseline.linesPerSec)} lines/sec  (${baseline.elapsedMs.toFixed(0)} ms, bots=${baseline.bots}, malformed=${baseline.malformed})`
  );

  console.log('Running withAi (identifyBot + classifyLogLineForAiSource)...');
  const withAi = runWithAi(lines);
  console.log(
    `  ${fmt(withAi.linesPerSec)} lines/sec  (${withAi.elapsedMs.toFixed(0)} ms, bots=${withAi.bots}, aiVisits=${withAi.aiVisits}, malformed=${withAi.malformed})`
  );

  const deltaPct = ((baseline.linesPerSec - withAi.linesPerSec) / baseline.linesPerSec) * 100;
  console.log(`\nDelta: ${deltaPct.toFixed(1)}% slowdown (gate: <= 15%)`);
  if (deltaPct > 15) {
    console.error('FAIL: benchmark gate exceeded');
    process.exit(1);
  } else {
    console.log('PASS: within 6.2b benchmark gate');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
