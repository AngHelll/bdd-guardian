# cucumber-demo — Capa B (JS/TS Cucumber.js)

Minimal Cucumber.js workspace for manual verification of BDD Guardian `js-cucumber` provider.

## Capa B (extras for v0.6.1+)

1. Install `bdd-guardian.vsix` (Extensions → … → Install from VSIX…)
2. **File → Open Folder…** → this directory
3. Wait for status bar **Ready** (or run **BDD Guardian: Reindex**)
4. Open `features/search.feature`
5. Verify:
   - Output channel lists JS Cucumber bindings indexed from `search.steps.ts`
   - CodeLens shows bound step definitions on all steps
   - **Go to Definition** (F12) navigates to `features/step_definitions/search.steps.ts`
   - Hover does not stay on “Indexing…” when bindings are loaded (v0.6.2+)

