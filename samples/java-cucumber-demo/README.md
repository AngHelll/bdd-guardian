# java-cucumber-demo — Capa B (Java Cucumber-JVM)

Minimal [Cucumber-JVM](https://cucumber.io/docs/installation/java/) Maven workspace for manual verification of BDD Guardian `java-cucumber` provider.

## Capa B (extras for v0.9.0+)

1. Install `bdd-guardian.vsix` (Extensions → … → Install from VSIX…)
2. **File → Open Folder…** → this directory
3. Wait for status bar **Ready** (or **BDD Guardian: Reindex**)
4. Open **Output → BDD Guardian** — expect **Java Cucumber: ACTIVE** and bindings indexed
5. Open `src/test/resources/features/search.feature`
6. Verify:
   - CodeLens shows bound steps on all three steps
   - **Go to Definition** (F12) navigates to `SearchStepDefinitions.java`
   - Gutter / Problems show bound status (diagnostics enabled)

## Run tests (optional)

Requires JDK 17+ and Maven:

```bash
mvn test
```

Guardian navigation does not execute tests; use [BDD Pilot](https://github.com/AngHelll/bdd-pilot) for execution workflows where supported.
