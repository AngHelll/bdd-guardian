import { describe, it, expect } from 'vitest';
import { shouldShowZeroBindingsHint } from '../features/onboarding/zeroBindingsHint';

describe('shouldShowZeroBindingsHint', () => {
    const base = {
        bindingCount: 0,
        featureCount: 1,
        dismissed: false,
        onboardingEnabled: true,
        isIndexing: false,
    };

    it('returns true when features exist but no bindings', () => {
        expect(shouldShowZeroBindingsHint(base)).toBe(true);
    });

    it('returns false when bindings exist', () => {
        expect(shouldShowZeroBindingsHint({ ...base, bindingCount: 3 })).toBe(false);
    });

    it('returns false when no feature files indexed', () => {
        expect(shouldShowZeroBindingsHint({ ...base, featureCount: 0 })).toBe(false);
    });

    it('returns false when user dismissed the hint', () => {
        expect(shouldShowZeroBindingsHint({ ...base, dismissed: true })).toBe(false);
    });

    it('returns false when onboarding is disabled', () => {
        expect(shouldShowZeroBindingsHint({ ...base, onboardingEnabled: false })).toBe(false);
    });

    it('returns false while indexing', () => {
        expect(shouldShowZeroBindingsHint({ ...base, isIndexing: true })).toBe(false);
    });
});
