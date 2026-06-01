import { describe, it, expect } from 'vitest';
import { applyCSharpProviderExclusivity } from '../providers/bindings/csharpProviderExclusivity';
import { createDetectionResult, type IBindingProvider, type ProviderDetectionReport } from '../providers/bindings/types';

function provider(id: string, displayName: string): IBindingProvider {
    return {
        id: id as IBindingProvider['id'],
        displayName,
        bindingFileExtensions: ['.cs'],
        bindingGlob: '**/*.cs',
        detect: async () => createDetectionResult(0, ['test']),
        indexBindings: async () => [],
        parseFile: () => [],
    };
}

describe('applyCSharpProviderExclusivity', () => {
    const reqnroll = provider('csharp-reqnroll', 'C# Reqnroll');
    const specflow = provider('csharp-specflow', 'C# SpecFlow');

    it('drops SpecFlow when Reqnroll has using Reqnroll (binding-demo case)', () => {
        const report: ProviderDetectionReport[] = [
            {
                id: 'csharp-reqnroll',
                displayName: 'C# Reqnroll',
                confidence: 0.5,
                reasons: ['Found [Binding] attribute in C# files'],
                signals: ['Found "using Reqnroll" in StepDefinitions/SampleSteps.cs'],
            },
            {
                id: 'csharp-specflow',
                displayName: 'C# SpecFlow',
                confidence: 0.3,
                reasons: ['Found [Binding] attribute in C# files'],
                signals: ['Found [Binding] in StepDefinitions/SampleSteps.cs'],
            },
        ];

        const active = applyCSharpProviderExclusivity([reqnroll, specflow], report);
        expect(active.map((p) => p.id)).toEqual(['csharp-reqnroll']);
    });

    it('keeps SpecFlow-only when TechTalk.SpecFlow is detected', () => {
        const report: ProviderDetectionReport[] = [
            {
                id: 'csharp-reqnroll',
                displayName: 'C# Reqnroll',
                confidence: 0.3,
                reasons: ['Found [Binding] attribute in C# files'],
                signals: [],
            },
            {
                id: 'csharp-specflow',
                displayName: 'C# SpecFlow',
                confidence: 0.5,
                reasons: ['Found SpecFlow PackageReference in .csproj'],
                signals: ['Found "using TechTalk.SpecFlow" in Steps/LoginSteps.cs'],
            },
        ];

        const active = applyCSharpProviderExclusivity([reqnroll, specflow], report);
        expect(active.map((p) => p.id)).toEqual(['csharp-specflow']);
    });

    it('leaves non-C# providers untouched', () => {
        const cucumber = provider('js-cucumber', 'JS Cucumber');
        const report: ProviderDetectionReport[] = [
            {
                id: 'csharp-reqnroll',
                displayName: 'C# Reqnroll',
                confidence: 0.5,
                reasons: [],
                signals: ['Found "using Reqnroll" in Steps.cs'],
            },
            {
                id: 'js-cucumber',
                displayName: 'JS Cucumber',
                confidence: 0.6,
                reasons: [],
                signals: [],
            },
        ];

        const active = applyCSharpProviderExclusivity([reqnroll, cucumber], report);
        expect(active.map((p) => p.id)).toEqual(['csharp-reqnroll', 'js-cucumber']);
    });
});
