import { describe, expect, it } from 'vitest';
import {
    PILOT_EXTENSION_ID,
    isPilotExtensionIdPresent,
    resolvePilotHandoffAction,
    resolvePostGenerateToastButtons,
} from '../features/ecosystem/pilotHandoff';

describe('pilotHandoff', () => {
    describe('isPilotExtensionIdPresent', () => {
        it('returns true when Pilot id is listed', () => {
            expect(
                isPilotExtensionIdPresent(['anghelll.bdd-guardian', PILOT_EXTENSION_ID])
            ).toBe(true);
        });

        it('returns false when Pilot id is missing', () => {
            expect(isPilotExtensionIdPresent(['anghelll.bdd-guardian'])).toBe(false);
        });
    });

    describe('resolvePilotHandoffAction', () => {
        it('returns none when handoff disabled', () => {
            expect(
                resolvePilotHandoffAction({ handoffEnabled: false, pilotInstalled: true })
            ).toBe('none');
            expect(
                resolvePilotHandoffAction({ handoffEnabled: false, pilotInstalled: false })
            ).toBe('none');
        });

        it('returns open when enabled and Pilot installed', () => {
            expect(
                resolvePilotHandoffAction({ handoffEnabled: true, pilotInstalled: true })
            ).toBe('open');
        });

        it('returns install when enabled and Pilot missing', () => {
            expect(
                resolvePilotHandoffAction({ handoffEnabled: true, pilotInstalled: false })
            ).toBe('install');
        });
    });

    describe('resolvePostGenerateToastButtons', () => {
        it('shows Pilot run only when enabled and installed', () => {
            expect(
                resolvePostGenerateToastButtons({
                    handoffEnabled: true,
                    pilotInstalled: true,
                }).showPilotRun
            ).toBe(true);
            expect(
                resolvePostGenerateToastButtons({
                    handoffEnabled: true,
                    pilotInstalled: false,
                }).showPilotRun
            ).toBe(false);
            expect(
                resolvePostGenerateToastButtons({
                    handoffEnabled: false,
                    pilotInstalled: true,
                }).showPilotRun
            ).toBe(false);
        });
    });
});
