/**
 * Step context — outline candidates from disk-read feature content (T-U02).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as vscode from 'vscode';
import { getStepAtPositionFromContent } from '../core/references/stepContext';

const FIXTURES = join(__dirname, 'fixtures');

describe('getStepAtPositionFromContent', () => {
    it('expands Scenario+Examples candidates for portfolio When step (closed-editor path)', () => {
        const featureText = readFileSync(join(FIXTURES, 'matching-corpus.feature'), 'utf-8');
        const uri = vscode.Uri.file(join(FIXTURES, 'matching-corpus.feature'));
        const step = getStepAtPositionFromContent(uri, featureText, 24);

        expect(step).toBeDefined();
        expect(step!.keywordResolved).toBe('When');
        expect(step!.candidateTexts.some((c) => c.includes('debt with investment time 5 years'))).toBe(true);
        expect(step!.candidateTexts.some((c) => c.includes('balance with investment time 10 years'))).toBe(true);
        expect(step!.isOutline).toBe(true);
    });
});
