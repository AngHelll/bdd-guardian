# binding-demo — Capa B dogfood workspace

Minimal Reqnroll workspace for manual verification of BDD Guardian (Capa B checklist).

## Contents

| Path | Purpose |
|------|---------|
| `Features/sample.feature` | Calculator + **v0.5.0** alignment scenarios |
| `StepDefinitions/SampleSteps.cs` | Reqnroll bindings (shared C# model as SpecFlow) |

Navigation-only sample (no `.csproj` required for Guardian indexing).

## Capa B — baseline (always)

1. Install `bdd-guardian.vsix` (Extensions → … → Install from VSIX…)
2. **File → Open Folder…** → this directory
3. Wait for status bar **Ready**
4. Open `Features/sample.feature`
5. Verify:
   - CodeLens shows bound class/method above `@P0` outline steps
   - **Go to Definition** (F12) on `Given the calculator is initialized` → `SampleSteps.cs`

## Capa B — v0.5.0 extras

Filter by tag `@v050` in the feature file, or jump to the scenarios at the bottom.

| Tag | Scenario | Expected in Guardian |
|-----|----------|----------------------|
| `@v050 @ambiguity` | Overlapping Then patterns | CodeLens **⚠️ ambiguous** on `Then the result should be 15…` (two bindings: `(.*)` and `\d+`). Not a silent ✅ bound. |
| `@v050 @outline-examples` | Deposit logged from Examples | CodeLens **✅ bound** → `LoggedAmountSteps.ThenLoggedAmount` even though `Examples` comes **after** the steps (plain `Scenario`, not `Scenario Outline`). |

## Capa B — v0.6.0 Wave A (Cucumber Expressions) extras

Filter by tag `@v060` in the feature file, or jump to the scenarios at the bottom.

| Tag | Scenario | Expected in Guardian |
|-----|----------|----------------------|
| `@v060 @cucumber-expressions` | Cucumber Expressions bindings resolve | CodeLens **✅ bound** on `{int}` / `{string}` bindings (no false unbound). |
| `@v060 @stepdefinition` | StepDefinition binds any keyword | CodeLens **✅ bound** on Given/When/Then all pointing to the same `AnyKeyword` method. |

### Optional settings

| Setting | Try |
|---------|-----|
| `bddGuardian.matching.preferSpecificBinding` | Set `true` → `@v050 @ambiguity` may show ✅ bound (legacy score winner). Default `false` = Reqnroll-like ambiguous. |

### Contrast scenarios (existing)

- **Scenario Outline** `@P0` — outline with multiple Examples tables (baseline)
- **Division** `@P1` — quoted strings + `Then the result should be 25` (also ambiguous on result step)
- **Whitespace** `@P2` — normalization

## With BDD Pilot

Guardian navigates; Pilot runs tests. Flow: fix bindings here → run [bdd-pilot](https://github.com/AngHelll/bdd-pilot) `samples/minimal-bdd` → if `PENDING_STEPS` / `AMBIGUOUS_STEPS`, return here.

**C# bindings:** Reqnroll and SpecFlow share the same attribute model; this sample uses Reqnroll. SpecFlow-only repos get the same Guardian experience (v0.5.0+).
