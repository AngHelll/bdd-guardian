import { describe, expect, it } from 'vitest';
import {
    FORMAT_EXTENSION_ID,
    OTHER_GHERKIN_FORMATTERS,
    shouldShowFormatHint,
} from '../features/ecosystem/formatHint';

const base = { hintEnabled: true, alreadyShown: false, installedIds: ['anghelll.bdd-guardian'] };

describe('shouldShowFormatHint', () => {
    it('shows once when no Gherkin formatter is installed', () => {
        expect(shouldShowFormatHint(base)).toBe(true);
    });

    it('stays quiet when disabled or already shown', () => {
        expect(shouldShowFormatHint({ ...base, hintEnabled: false })).toBe(false);
        expect(shouldShowFormatHint({ ...base, alreadyShown: true })).toBe(false);
    });

    it('stays quiet when Format is installed', () => {
        expect(
            shouldShowFormatHint({ ...base, installedIds: [...base.installedIds, FORMAT_EXTENSION_ID] })
        ).toBe(false);
    });

    it('stays quiet next to another Gherkin formatter, whatever the id casing', () => {
        for (const id of OTHER_GHERKIN_FORMATTERS) {
            expect(shouldShowFormatHint({ ...base, installedIds: [id] })).toBe(false);
        }
        expect(
            shouldShowFormatHint({ ...base, installedIds: ['CucumberOpen.cucumber-official'] })
        ).toBe(false);
    });
});
