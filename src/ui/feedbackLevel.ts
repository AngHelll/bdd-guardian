/**
 * Feedback level presets — pure (no vscode).
 * Preset is a ceiling; granular toggles AND down.
 */

export type FeedbackLevel = 'full' | 'standard' | 'minimal';

export interface FeedbackToggleInputs {
    readonly gutter: boolean;
    readonly border: boolean;
    readonly problems: boolean;
    readonly codeLens: boolean;
}

export interface FeedbackChannels {
    readonly gutter: boolean;
    readonly border: boolean;
    readonly problems: boolean;
    readonly codeLens: boolean;
}

const PRESET_CEILING: Record<FeedbackLevel, FeedbackChannels> = {
    full: { gutter: true, border: true, problems: true, codeLens: true },
    standard: { gutter: true, border: false, problems: true, codeLens: true },
    minimal: { gutter: false, border: false, problems: false, codeLens: true },
};

export function normalizeFeedbackLevel(value: unknown): FeedbackLevel {
    if (value === 'standard' || value === 'minimal' || value === 'full') {
        return value;
    }
    return 'full';
}

/**
 * Effective UI channels = preset ceiling ∧ toggles.
 */
export function resolveFeedbackChannels(
    feedbackLevel: FeedbackLevel | unknown,
    toggles: FeedbackToggleInputs
): FeedbackChannels {
    const ceiling = PRESET_CEILING[normalizeFeedbackLevel(feedbackLevel)];
    return {
        gutter: ceiling.gutter && toggles.gutter,
        border: ceiling.border && toggles.border,
        problems: ceiling.problems && toggles.problems,
        codeLens: ceiling.codeLens && toggles.codeLens,
    };
}
