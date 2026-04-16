/**
 * Client-side prompt set types mirroring the API response shape.
 * See: modules/prompt-sets/prompt-set.schema.ts (database schema)
 * See: app/api/v1/prompt-sets/route.ts (API response)
 */

export interface PromptSet {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PromptSetDetail extends PromptSet {
  promptCount: number;
}

export interface CreatePromptSetInput {
  name: string;
  description?: string;
  tags?: string[];
}

export interface UpdatePromptSetInput {
  name?: string;
  description?: string | null;
  tags?: string[];
}

export interface Prompt {
  id: string;
  promptSetId: string;
  template: string;
  order: number;
  createdAt: string;
}

export interface CreatePromptInput {
  template: string;
  order?: number;
}

export interface UpdatePromptInput {
  template?: string;
  order?: number;
}
