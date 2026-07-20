# BDD Guardian CLI

Headless inventory and map analysis for agents and CI — **no VS Code Extension Host**.

## Commands

```bash
npm run compile   # once (or after pulling)
npm run guardian -- discover <project-dir>
npm run guardian -- analyze <project-dir> [--max-items <n>]
```

| Exit | Meaning |
|------|---------|
| `0` | OK (JSON on stdout) |
| `1` | I/O or load error |
| `2` | Usage / bad args |

`--max-items` (default **50**) caps the `unbound` / `ambiguous` / `orphans` arrays in `analyze` output. Counts are always complete.

## Output

JSON with `schemaVersion: 1`.

- **discover** — features (path + stepCount), bindings (path + pattern + providerId), `providersDetected`
- **analyze** — `counts` (features, steps, bindings, bound, unbound, ambiguous, orphanBindings) plus capped detail lists

Matching uses the same resolver path as the extension (`preferSpecificBinding: false`).

## Notes

- Does **not** run tests (use [BDD Pilot](https://github.com/AngHelll/bdd-pilot) for execution).
- Does **not** replace Index API `extension.exports` for Jarvis.
- Scripts live under `scripts/`; they are excluded from the Marketplace VSIX (`.vscodeignore`).
