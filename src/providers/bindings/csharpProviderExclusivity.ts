import type { IBindingProvider, ProviderDetectionReport } from './types';

const REQ_ID = 'csharp-reqnroll';
const SPEC_ID = 'csharp-specflow';

/**
 * Reqnroll and SpecFlow share the same C# parser and glob — only one should index .cs files.
 */
export function applyCSharpProviderExclusivity(
    active: readonly IBindingProvider[],
    report: readonly ProviderDetectionReport[]
): IBindingProvider[] {
    const hasReqnroll = active.some((p) => p.id === REQ_ID);
    const hasSpecflow = active.some((p) => p.id === SPEC_ID);
    if (!hasReqnroll || !hasSpecflow) {
        return [...active];
    }

    const reqnroll = report.find((r) => r.id === REQ_ID);
    const specflow = report.find((r) => r.id === SPEC_ID);
    const keepReqnroll = shouldPreferReqnroll(reqnroll, specflow);

    const dropId = keepReqnroll ? SPEC_ID : REQ_ID;
    return active.filter((p) => p.id !== dropId);
}

function shouldPreferReqnroll(
    reqnroll: ProviderDetectionReport | undefined,
    specflow: ProviderDetectionReport | undefined
): boolean {
    if (reqnroll?.signals.some((s) => /using Reqnroll/i.test(s))) {
        return true;
    }
    if (reqnroll?.reasons.some((r) => /Reqnroll PackageReference/i.test(r))) {
        return true;
    }
    if (specflow?.signals.some((s) => /TechTalk\.SpecFlow/i.test(s))) {
        return false;
    }
    if (specflow?.reasons.some((r) => /SpecFlow PackageReference/i.test(r))) {
        return false;
    }
    return (reqnroll?.confidence ?? 0) >= (specflow?.confidence ?? 0);
}
