import { describe, expect, it } from 'vitest';
import {
    normalizeFeedbackLevel,
    resolveFeedbackChannels,
} from '../ui/feedbackLevel';

const ALL_ON = {
    gutter: true,
    border: true,
    problems: true,
    codeLens: true,
};

describe('resolveFeedbackChannels', () => {
    it('full with all toggles on enables every channel', () => {
        expect(resolveFeedbackChannels('full', ALL_ON)).toEqual(ALL_ON);
    });

    it('standard disables border only', () => {
        expect(resolveFeedbackChannels('standard', ALL_ON)).toEqual({
            gutter: true,
            border: false,
            problems: true,
            codeLens: true,
        });
    });

    it('minimal keeps CodeLens only', () => {
        expect(resolveFeedbackChannels('minimal', ALL_ON)).toEqual({
            gutter: false,
            border: false,
            problems: false,
            codeLens: true,
        });
    });

    it('granular toggle off wins over preset ceiling', () => {
        expect(
            resolveFeedbackChannels('full', {
                gutter: false,
                border: true,
                problems: false,
                codeLens: true,
            })
        ).toEqual({
            gutter: false,
            border: true,
            problems: false,
            codeLens: true,
        });
    });

    it('minimal cannot re-enable gutter via toggle', () => {
        expect(resolveFeedbackChannels('minimal', ALL_ON).gutter).toBe(false);
    });

    it('normalizeFeedbackLevel falls back to full', () => {
        expect(normalizeFeedbackLevel('nope')).toBe('full');
        expect(normalizeFeedbackLevel(undefined)).toBe('full');
        expect(normalizeFeedbackLevel('standard')).toBe('standard');
    });
});
