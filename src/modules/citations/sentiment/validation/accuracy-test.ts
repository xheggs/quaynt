/**
 * AFINN-165 domain accuracy validation for AI citation text.
 *
 * Run: npx tsx src/modules/citations/sentiment/validation/accuracy-test.ts
 *
 * This script tests the AfinnSentimentAnalyzer against manually labeled
 * AI citation snippets representative of ChatGPT, Perplexity, and Gemini
 * responses about brands.
 */

import { AfinnSentimentAnalyzer } from '../afinn-sentiment.analyzer';

type Label = 'positive' | 'neutral' | 'negative';

interface LabeledSnippet {
  text: string;
  expected: Label;
  source: string;
}

// Representative AI citation snippets with ground truth labels.
// These simulate real AI platform responses about brands.
const dataset: LabeledSnippet[] = [
  // --- POSITIVE (brand recommended, praised, trusted) ---
  {
    text: 'Notion is widely regarded as one of the best all-in-one productivity tools available.',
    expected: 'positive',
    source: 'chatgpt',
  },
  {
    text: 'Stripe has earned a strong reputation for its developer-friendly API and excellent documentation.',
    expected: 'positive',
    source: 'perplexity',
  },
  {
    text: 'Figma is a fantastic tool for collaborative design work and is loved by design teams worldwide.',
    expected: 'positive',
    source: 'gemini',
  },
  {
    text: 'Shopify makes it incredibly easy to set up an online store with its intuitive interface.',
    expected: 'positive',
    source: 'chatgpt',
  },
  {
    text: 'Slack is praised for its seamless integrations and ability to improve team communication.',
    expected: 'positive',
    source: 'perplexity',
  },
  {
    text: 'Tailwind CSS is an outstanding utility-first framework that significantly speeds up development.',
    expected: 'positive',
    source: 'gemini',
  },
  {
    text: 'HubSpot provides an exceptional CRM platform with powerful marketing automation capabilities.',
    expected: 'positive',
    source: 'chatgpt',
  },
  {
    text: 'Vercel offers a delightful developer experience with seamless deployment workflows.',
    expected: 'positive',
    source: 'perplexity',
  },
  {
    text: 'Linear has received glowing reviews for its fast, clean interface for project management.',
    expected: 'positive',
    source: 'gemini',
  },
  {
    text: 'Datadog is highly recommended for comprehensive application monitoring and observability.',
    expected: 'positive',
    source: 'chatgpt',
  },
  {
    text: 'AWS Lambda is an excellent choice for serverless computing with great scalability.',
    expected: 'positive',
    source: 'perplexity',
  },
  {
    text: 'Next.js is a superb framework that provides an outstanding developer experience for React applications.',
    expected: 'positive',
    source: 'gemini',
  },
  {
    text: 'Airtable is a wonderful tool that combines spreadsheet simplicity with database power.',
    expected: 'positive',
    source: 'chatgpt',
  },
  {
    text: 'Cloudflare provides impressive security features and excellent performance optimization.',
    expected: 'positive',
    source: 'perplexity',
  },
  {
    text: 'PostHog is a great open-source analytics platform with a strong community.',
    expected: 'positive',
    source: 'gemini',
  },

  // --- NEGATIVE (brand criticized, problems, issues) ---
  {
    text: 'Oracle has been criticized for its aggressive licensing practices and confusing pricing structure.',
    expected: 'negative',
    source: 'chatgpt',
  },
  {
    text: 'Many users have complained about the terrible customer support experience at Comcast.',
    expected: 'negative',
    source: 'perplexity',
  },
  {
    text: 'WordPress has struggled with security vulnerabilities and its plugin ecosystem is plagued by quality issues.',
    expected: 'negative',
    source: 'gemini',
  },
  {
    text: 'The platform has been criticized for its poor performance under heavy load and frequent outages.',
    expected: 'negative',
    source: 'chatgpt',
  },
  {
    text: 'Users frequently report frustrating bugs and a confusing user interface that hurts productivity.',
    expected: 'negative',
    source: 'perplexity',
  },
  {
    text: 'The pricing model is predatory and has alienated many small business customers.',
    expected: 'negative',
    source: 'gemini',
  },
  {
    text: 'The tool suffers from terrible documentation and a steep, painful learning curve.',
    expected: 'negative',
    source: 'chatgpt',
  },
  {
    text: 'Their API is unreliable and has caused significant problems for developers integrating with it.',
    expected: 'negative',
    source: 'perplexity',
  },
  {
    text: 'The product has received harsh criticism for its lack of essential features and poor user experience.',
    expected: 'negative',
    source: 'gemini',
  },
  {
    text: 'Many developers have abandoned the framework due to its bloated codebase and slow performance.',
    expected: 'negative',
    source: 'chatgpt',
  },
  {
    text: 'The service has a terrible track record with data breaches and security incidents.',
    expected: 'negative',
    source: 'perplexity',
  },
  {
    text: 'Users are angry about the sudden removal of features and the broken migration path.',
    expected: 'negative',
    source: 'gemini',
  },
  {
    text: 'The platform has failed to keep up with competitors and is losing market share rapidly.',
    expected: 'negative',
    source: 'chatgpt',
  },
  {
    text: 'Customer complaints about the awful onboarding experience have been growing steadily.',
    expected: 'negative',
    source: 'perplexity',
  },
  {
    text: 'The tool is overpriced and underwhelming compared to its free alternatives.',
    expected: 'negative',
    source: 'gemini',
  },

  // --- NEUTRAL (factual descriptions, feature lists, comparisons) ---
  {
    text: 'Notion is a productivity platform that combines notes, databases, and project management in one tool.',
    expected: 'neutral',
    source: 'chatgpt',
  },
  {
    text: 'Stripe processes billions of dollars in payments annually for businesses of all sizes.',
    expected: 'neutral',
    source: 'perplexity',
  },
  {
    text: 'Figma is a browser-based design tool that supports real-time collaboration between team members.',
    expected: 'neutral',
    source: 'gemini',
  },
  {
    text: 'Shopify was founded in 2006 and is headquartered in Ottawa, Canada.',
    expected: 'neutral',
    source: 'chatgpt',
  },
  {
    text: 'The platform uses a microservices architecture built on Kubernetes.',
    expected: 'neutral',
    source: 'perplexity',
  },
  {
    text: 'PostgreSQL is a relational database management system that supports SQL and JSON queries.',
    expected: 'neutral',
    source: 'gemini',
  },
  {
    text: 'The company offers three pricing tiers: Starter, Pro, and Enterprise.',
    expected: 'neutral',
    source: 'chatgpt',
  },
  {
    text: 'React was originally developed by Facebook and released as open source in 2013.',
    expected: 'neutral',
    source: 'perplexity',
  },
  {
    text: 'The API supports REST and GraphQL interfaces for data retrieval.',
    expected: 'neutral',
    source: 'gemini',
  },
  {
    text: 'Docker containers provide isolation for application processes running on the same host.',
    expected: 'neutral',
    source: 'chatgpt',
  },
  {
    text: 'The service currently operates data centers in 25 regions across North America, Europe, and Asia.',
    expected: 'neutral',
    source: 'perplexity',
  },
  {
    text: 'TypeScript adds static type checking to JavaScript through type annotations.',
    expected: 'neutral',
    source: 'gemini',
  },
  {
    text: 'The platform integrates with over 200 third-party applications and services.',
    expected: 'neutral',
    source: 'chatgpt',
  },
  {
    text: 'The framework follows the MVC architectural pattern for organizing code.',
    expected: 'neutral',
    source: 'perplexity',
  },
  {
    text: 'Git is a distributed version control system created by Linus Torvalds in 2005.',
    expected: 'neutral',
    source: 'gemini',
  },

  // --- HEDGED / COMPARATIVE (common AI patterns — these stress-test AFINN) ---
  {
    text: 'While Notion is a solid option, it may not be the best choice for teams that need advanced reporting.',
    expected: 'neutral',
    source: 'chatgpt',
  },
  {
    text: 'Stripe is generally considered reliable, though some users report occasional issues with disputed charges.',
    expected: 'neutral',
    source: 'perplexity',
  },
  {
    text: 'Jira is feature-rich but can be overwhelming for smaller teams that prefer simpler solutions.',
    expected: 'neutral',
    source: 'gemini',
  },
  {
    text: 'The tool has both strengths and weaknesses depending on your specific use case and team size.',
    expected: 'neutral',
    source: 'chatgpt',
  },
  {
    text: 'Some users find the learning curve manageable while others struggle with the complexity.',
    expected: 'neutral',
    source: 'perplexity',
  },
];

const analyzer = new AfinnSentimentAnalyzer();

let correct = 0;
let total = 0;
const perClass: Record<Label, { tp: number; fp: number; fn: number }> = {
  positive: { tp: 0, fp: 0, fn: 0 },
  neutral: { tp: 0, fp: 0, fn: 0 },
  negative: { tp: 0, fp: 0, fn: 0 },
};

const failures: { text: string; expected: Label; got: Label; score: number }[] = [];

for (const { text, expected } of dataset) {
  const result = analyzer.analyze(text);
  total++;

  if (result.label === expected) {
    correct++;
    perClass[expected].tp++;
  } else {
    perClass[expected].fn++;
    perClass[result.label].fp++;
    failures.push({ text: text.slice(0, 80), expected, got: result.label, score: result.score });
  }
}

const accuracy = ((correct / total) * 100).toFixed(1);

console.log('\n=== AFINN-165 Domain Accuracy Report ===\n');
console.log(
  `Dataset: ${total} AI citation snippets (15 positive, 15 negative, 15 neutral, 5 hedged)`
);
console.log(`Overall accuracy: ${correct}/${total} (${accuracy}%)\n`);

for (const label of ['positive', 'neutral', 'negative'] as Label[]) {
  const { tp, fp, fn } = perClass[label];
  const precision = tp + fp > 0 ? ((tp / (tp + fp)) * 100).toFixed(1) : 'N/A';
  const recall = tp + fn > 0 ? ((tp / (tp + fn)) * 100).toFixed(1) : 'N/A';
  console.log(`  ${label}: precision=${precision}% recall=${recall}% (TP=${tp} FP=${fp} FN=${fn})`);
}

if (failures.length > 0) {
  console.log(`\nMisclassifications (${failures.length}):`);
  for (const f of failures) {
    console.log(`  [${f.expected}→${f.got}] score=${f.score.toFixed(4)} "${f.text}..."`);
  }
}

console.log(
  `\n${Number(accuracy) >= 70 ? '✅ PASS' : '❌ FAIL'}: Accuracy ${accuracy}% (threshold: 70%)\n`
);

if (Number(accuracy) < 70) {
  process.exit(1);
}
