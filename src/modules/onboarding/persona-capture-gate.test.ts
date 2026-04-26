// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { shouldEmitPersonaCapturedPostAha } from './persona-capture-gate';
import { DEFAULT_ONBOARDING_MILESTONES } from './onboarding.schema';

const baseMilestones = { ...DEFAULT_ONBOARDING_MILESTONES };

describe('shouldEmitPersonaCapturedPostAha', () => {
  it('emits on first post-aha capture (null → non-null, firstCitationSeen=true)', () => {
    const result = shouldEmitPersonaCapturedPostAha(
      {
        roleHint: null,
        milestones: { ...baseMilestones, firstCitationSeen: true },
      },
      { roleHint: 'marketing' }
    );
    expect(result).toBe(true);
  });

  it('does not emit pre-aha (firstCitationSeen=false)', () => {
    const result = shouldEmitPersonaCapturedPostAha(
      {
        roleHint: null,
        milestones: { ...baseMilestones, firstCitationSeen: false },
      },
      { roleHint: 'marketing' }
    );
    expect(result).toBe(false);
  });

  it('does not emit on role change (current already has a role)', () => {
    const result = shouldEmitPersonaCapturedPostAha(
      {
        roleHint: 'marketing',
        milestones: { ...baseMilestones, firstCitationSeen: true },
      },
      { roleHint: 'seo' }
    );
    expect(result).toBe(false);
  });

  it('does not emit when patch sets roleHint to null', () => {
    const result = shouldEmitPersonaCapturedPostAha(
      {
        roleHint: null,
        milestones: { ...baseMilestones, firstCitationSeen: true },
      },
      { roleHint: null }
    );
    expect(result).toBe(false);
  });

  it('does not emit when patch omits roleHint', () => {
    const result = shouldEmitPersonaCapturedPostAha(
      {
        roleHint: null,
        milestones: { ...baseMilestones, firstCitationSeen: true },
      },
      {}
    );
    expect(result).toBe(false);
  });
});
