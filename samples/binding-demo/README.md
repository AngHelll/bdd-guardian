# binding-demo — Capa B dogfood workspace

Minimal workspace for manual verification of BDD Guardian (Capa B checklist).

## Contents

- `Features/sample.feature` — calculator scenarios (outline, quotes, whitespace)
- `StepDefinitions/SampleSteps.cs` — Reqnroll C# bindings

Copied from `src/__tests__/fixtures/` — keep in sync when fixtures change materially.

## Capa B steps

1. Install `bdd-guardian.vsix` (Install from VSIX…)
2. **File → Open Folder…** → this directory (`samples/binding-demo`)
3. Wait for status bar **Ready**
4. Open `Features/sample.feature`
5. Verify:
   - CodeLens shows bound class/method above steps
   - **Go to Definition** (F12) on a step opens `SampleSteps.cs`
   - Optional: enable Coach (`bddGuardian.coach.enabled`) and check Problems panel

## With BDD Pilot

Open [bdd-pilot](https://github.com/AngHelll/bdd-pilot) `samples/minimal-bdd` for test **execution**; this sample is for **navigation/bindings** only.
