/**
 * Default prompt set seeded into every newly created workspace so the
 * onboarding wizard always has a runnable option in step 4.
 *
 * Notes on i18n: prompt strings are user-editable content (same as any
 * user-authored prompt) and are persisted verbatim. The display name and
 * description shown as wizard chrome go through translation keys; these
 * static strings do not.
 *
 * Templates use the `{{brand}}` interpolation token consistent with the
 * rest of the app's prompt template handling.
 */
export const STARTER_PROMPT_SET = {
  name: 'Quaynt Starter',
  description: 'Eight generic prompts spanning recommendation, comparison, and category questions.',
  prompts: [
    'What are the best alternatives to {{brand}}?',
    'Is {{brand}} a good choice for small businesses?',
    'How does {{brand}} compare to its top competitors?',
    'What do customers say about {{brand}}?',
    'Recommend a tool like {{brand}} for enterprise teams.',
    'What are the pros and cons of using {{brand}}?',
    'Which companies are similar to {{brand}}?',
    'Is {{brand}} worth the price?',
  ],
} as const;
