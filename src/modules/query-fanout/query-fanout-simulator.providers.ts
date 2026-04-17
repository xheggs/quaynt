import {
  SIMULATOR_RESPONSE_SCHEMA_JSON,
  SIMULATOR_RESPONSE_ZOD,
  SIMULATOR_SYSTEM_PROMPT,
  type SimulatorResponsePayload,
} from './query-fanout-simulator.prompt';
import {
  SimulationError,
  SimulationParseError,
  SimulationRateLimitError,
  SimulationTimeoutError,
  type SimulationProvider,
  type SimulationUsage,
} from './query-fanout-simulator.types';

const DEFAULT_TIMEOUT_MS = 15_000;

export interface CallProviderInput {
  provider: SimulationProvider;
  apiKey: string;
  modelId: string;
  promptText: string;
  temperature: number;
  subQueryTarget: number;
}

export interface CallProviderResult {
  payload: SimulatorResponsePayload;
  modelVersion: string | null;
  usage: SimulationUsage | null;
}

export async function callProvider(input: CallProviderInput): Promise<CallProviderResult> {
  // Try once, retry once on parse failure with a stricter user instruction.
  const instructions = [
    buildUserMessage(input.promptText, input.subQueryTarget),
    buildUserMessage(
      input.promptText,
      input.subQueryTarget,
      'Respond with a single JSON object. Do not wrap the response in markdown fences. Do not include any prose before or after the JSON.'
    ),
  ];
  let lastParseError: unknown = null;
  for (const userMessage of instructions) {
    try {
      const raw = await dispatchProvider({ ...input, userMessage });
      const parsed = SIMULATOR_RESPONSE_ZOD.safeParse(raw.parsedBody);
      if (parsed.success) {
        return {
          payload: parsed.data,
          modelVersion: raw.modelVersion,
          usage: raw.usage,
        };
      }
      lastParseError = parsed.error;
    } catch (err) {
      if (err instanceof SimulationError) throw err;
      throw err;
    }
  }
  throw new SimulationParseError(
    'Simulator output did not validate against schema after one retry',
    lastParseError
  );
}

function buildUserMessage(promptText: string, subQueryTarget: number, stricter?: string): string {
  const target = Math.max(1, Math.floor(subQueryTarget));
  const base = `User prompt:\n${promptText}\n\nProduce approximately ${target} sub-queries, as specified. Return only valid JSON.`;
  return stricter ? `${base}\n\n${stricter}` : base;
}

interface DispatchProviderInput extends CallProviderInput {
  userMessage: string;
}

interface DispatchProviderResult {
  parsedBody: unknown;
  modelVersion: string | null;
  usage: SimulationUsage | null;
}

async function dispatchProvider(input: DispatchProviderInput): Promise<DispatchProviderResult> {
  switch (input.provider) {
    case 'openai':
      return callOpenAI(input);
    case 'anthropic':
      return callAnthropic(input);
    case 'gemini':
      return callGemini(input);
  }
}

// -- OpenAI — Chat Completions + Structured Outputs ------------------------

async function callOpenAI(input: DispatchProviderInput): Promise<DispatchProviderResult> {
  const body = {
    model: input.modelId,
    temperature: input.temperature,
    messages: [
      { role: 'system', content: SIMULATOR_SYSTEM_PROMPT },
      { role: 'user', content: input.userMessage },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'query_fanout_simulation',
        schema: SIMULATOR_RESPONSE_SCHEMA_JSON,
        strict: true,
      },
    },
  };

  const res = await simulatorFetch(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    'openai'
  );

  const json = (await res.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new SimulationParseError('OpenAI response missing message content');
  }
  return {
    parsedBody: safeJsonParse(content),
    modelVersion: typeof json.model === 'string' ? json.model : null,
    usage: {
      inputTokens: typeof json.usage?.prompt_tokens === 'number' ? json.usage.prompt_tokens : null,
      outputTokens:
        typeof json.usage?.completion_tokens === 'number' ? json.usage.completion_tokens : null,
    },
  };
}

// -- Anthropic — Messages API with forced single-tool use ------------------

async function callAnthropic(input: DispatchProviderInput): Promise<DispatchProviderResult> {
  const TOOL_NAME = 'emit_simulated_fanout';
  const body = {
    model: input.modelId,
    max_tokens: 4096,
    temperature: input.temperature,
    system: SIMULATOR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: input.userMessage }],
    tools: [
      {
        name: TOOL_NAME,
        description: 'Emit the simulated query fan-out as structured JSON.',
        input_schema: SIMULATOR_RESPONSE_SCHEMA_JSON,
      },
    ],
    tool_choice: { type: 'tool', name: TOOL_NAME },
  };

  const res = await simulatorFetch(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'x-api-key': input.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    'anthropic'
  );

  const json = (await res.json()) as {
    model?: string;
    content?: Array<{ type: string; name?: string; input?: unknown }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const toolUse = json.content?.find((c) => c.type === 'tool_use' && c.name === TOOL_NAME);
  if (!toolUse || toolUse.input === undefined) {
    throw new SimulationParseError('Anthropic response missing tool_use block');
  }
  return {
    parsedBody: toolUse.input,
    modelVersion: typeof json.model === 'string' ? json.model : null,
    usage: {
      inputTokens: typeof json.usage?.input_tokens === 'number' ? json.usage.input_tokens : null,
      outputTokens: typeof json.usage?.output_tokens === 'number' ? json.usage.output_tokens : null,
    },
  };
}

// -- Gemini — generateContent with responseSchema --------------------------

async function callGemini(input: DispatchProviderInput): Promise<DispatchProviderResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    input.modelId
  )}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: SIMULATOR_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: input.userMessage }] }],
    generationConfig: {
      temperature: input.temperature,
      responseMimeType: 'application/json',
      responseSchema: SIMULATOR_RESPONSE_SCHEMA_JSON,
    },
  };

  const res = await simulatorFetch(
    url,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': input.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    'gemini'
  );

  const json = (await res.json()) as {
    modelVersion?: string;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new SimulationParseError('Gemini response missing candidate text');
  }
  return {
    parsedBody: safeJsonParse(text),
    modelVersion: typeof json.modelVersion === 'string' ? json.modelVersion : null,
    usage: {
      inputTokens:
        typeof json.usageMetadata?.promptTokenCount === 'number'
          ? json.usageMetadata.promptTokenCount
          : null,
      outputTokens:
        typeof json.usageMetadata?.candidatesTokenCount === 'number'
          ? json.usageMetadata.candidatesTokenCount
          : null,
    },
  };
}

// -- Transport -------------------------------------------------------------

async function simulatorFetch(
  url: string,
  init: RequestInit,
  provider: SimulationProvider
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new SimulationTimeoutError(
        `${provider} simulation request exceeded ${DEFAULT_TIMEOUT_MS}ms`,
        err
      );
    }
    throw new SimulationError(
      `${provider} simulation request failed: ${err instanceof Error ? err.message : 'unknown'}`,
      'simulation_failed',
      err
    );
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 429) {
    const retryAfterMs = parseRetryAfterMs(res.headers);
    throw new SimulationRateLimitError(`${provider} simulation rate limit exceeded`, retryAfterMs);
  }

  if (!res.ok) {
    const detail = await safeReadText(res);
    throw new SimulationError(
      `${provider} simulation returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      'simulation_failed'
    );
  }

  return res;
}

function parseRetryAfterMs(headers: Headers): number | null {
  const raw = headers.get('retry-after');
  if (!raw) return null;
  const asSeconds = parseFloat(raw);
  if (!Number.isNaN(asSeconds) && asSeconds >= 0) return Math.ceil(asSeconds * 1000);
  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

async function safeReadText(res: Response): Promise<string | null> {
  try {
    return (await res.text()) || null;
  } catch {
    return null;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Strip common junk (markdown fences, leading labels) and try once more.
    const stripped = text
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    return JSON.parse(stripped);
  }
}
