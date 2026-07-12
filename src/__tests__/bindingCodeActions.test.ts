import { describe, expect, it } from 'vitest';
import { isUnboundBindingDiagnostic } from '../features/author/scaffoldInsert';
import { BINDINGS_DIAGNOSTIC_SOURCE, UNBOUND_STEP_DIAGNOSTIC_CODE } from '../core/domain/constants';

describe('bindingCodeActions', () => {
    it('isUnboundBindingDiagnostic matches Guardian unbound code only', () => {
        expect(
            isUnboundBindingDiagnostic({
                source: BINDINGS_DIAGNOSTIC_SOURCE,
                code: UNBOUND_STEP_DIAGNOSTIC_CODE,
            })
        ).toBe(true);
        expect(
            isUnboundBindingDiagnostic({
                source: BINDINGS_DIAGNOSTIC_SOURCE,
                code: undefined,
            })
        ).toBe(false);
        expect(
            isUnboundBindingDiagnostic({
                source: 'BDD Coach',
                code: UNBOUND_STEP_DIAGNOSTIC_CODE,
            })
        ).toBe(false);
    });
});
