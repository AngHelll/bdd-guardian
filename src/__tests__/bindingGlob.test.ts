import { describe, it, expect } from 'vitest';
import { splitTopLevelGlobAlternatives } from '../core/index/bindingGlob';
import { getJsCucumberProvider } from '../providers/bindings/jsCucumberProvider';

describe('splitTopLevelGlobAlternatives', () => {
    it('returns a single pattern when there are no top-level braces', () => {
        expect(splitTopLevelGlobAlternatives('**/*.cs')).toEqual(['**/*.cs']);
    });

    it('splits js-cucumber provider alternation without breaking extension braces', () => {
        const glob = getJsCucumberProvider().bindingGlob;
        const parts = splitTopLevelGlobAlternatives(glob);
        expect(parts.length).toBeGreaterThan(1);
        expect(parts.some((p) => p.includes('step_definitions'))).toBe(true);
        expect(parts.some((p) => p.includes('features/**/*.{js,ts'))).toBe(true);
    });
});
