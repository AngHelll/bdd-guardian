# BDD Guardian – Roadmap

Mejoras alineadas con la esencia del producto: **navegar y validar pasos BDD** entre Gherkin y step definitions (Reqnroll, SpecFlow, Cucumber, etc.).

Para visión y enlaces a toda la documentación, ver [docs/README.md](./README.md).

---

## Dirección del producto

| Capa | Objetivo |
|------|----------|
| **Core** | Índice + matching (regex, scoring) agnóstico del framework |
| **Providers** | Detección e indexado de bindings por lenguaje/framework |
| **VS Code UX** | CodeLens, go to definition, diagnósticos, decoraciones, historial |
| **Coach** | Calidad de `.feature` (reglas opcionales, no bloquea el flujo principal) |

**No es MVP actual** (backlog explícito): autocompletado de pasos, generar binding desde step, “copy as pattern”. Están en [CHANGELOG](../CHANGELOG.md) [Unreleased] y abajo como prioridad baja.

---

## Hecho

- **Navegación step ↔ binding:** Go to Definition, CodeLens en `.feature`, hover, historial Alt+←/→.
- **Binding usages:** CodeLens en archivos de bindings (C#, TS, JS, Python, Go registrados) con “→ N usages”; multi-provider vía índice + resolver.
- **Indexado:** status bar “Indexing…” / “Ready”; reindex en guardado y en disco (file watcher).
- **Indexado al editar:** buffer abierto del `.feature` (sin esperar solo al guardar); bindings reemplazados por archivo (sin acumular duplicados en reindex incremental).
- **Matching:** literal `$`/`^`, verbatim C# `""`, normalización de espacios en patrón = step; doc en [BINDING_MATCHING.md](./BINDING_MATCHING.md).
- **Coach v2:** reglas (GWT, duplicate steps, vague then, etc.), Health Score, quick fixes; parser único con `core`; idiomas `feature` y `gherkin`.
- **i18n:** mensajes UI en inglés/español (`bddGuardian.displayLanguage`).
- **DX:** `AGENTS.md`, rule/skill Cursor para matching.

---

## Pulido (cerrar gaps pequeños)

### Matching regex — casi cerrado

- **Hecho:** ver [BINDING_MATCHING.md](./BINDING_MATCHING.md) y tests en `bindingRegex.test.ts`.
- **Opcional:** `countCaptureGroups` ignorando `(` dentro de `[...]`; más tests con alternaciones `|` y cuantificadores.
- **Known issue consciente:** patrones muy avanzados (lookaheads, alternaciones complejas) pueden comportarse distinto; documentado en README.

---

## Prioridad media

### Más frameworks (Cucumber JS, Behave, Godog)

- **Estado:** stubs (`jsCucumberProvider`, `pythonBehaveProvider`, `goGodogProvider`, …); C# Reqnroll y SpecFlow completos.
- **Orden sugerido:** Cucumber JS → Behave → Godog. Ver [PROVIDERS.md](./PROVIDERS.md).

### Find All References

- Step en `.feature` → otros usos del mismo texto/binding.
- Binding en `.cs` → exponer como `ReferenceProvider` (Shift+F12) además del CodeLens de usages.

### Coach: más reglas y quick fixes

- Reglas posibles: un Then dominante por escenario, imperativo, tags redundantes.
- Ampliar quick fixes (vague then, too many steps).

### Autocompletado de pasos

- Sugerir textos desde bindings indexados al escribir Given/When/Then.

---

## Prioridad baja / backlog

### Generar binding desde el step

- Code action sobre step unbound → esqueleto C# (u otro lenguaje con provider).

### Copy as pattern

- Copiar patrón escapado para `[Given("...")]`.

### Mejor onboarding

- Mensaje si no hay `.feature`/bindings; GIF en README/Marketplace (CodeLens, Go to Definition, Coach).

---

## Resumen por impacto

| Área | Siguiente paso | Esencia |
|------|----------------|---------|
| Frameworks | Cucumber JS provider | Extensión |
| Navegación | Find All References | Core |
| Matching | Edge cases regex (opcional) | Precisión |
| Coach | Reglas + quick fixes | Calidad BDD |
| Productividad | Autocomplete, generate binding | Backlog |

**Recomendación para la siguiente versión:** un provider no-C# (Cucumber JS) **o** Find All References — según audiencia; el matching base y el indexado incremental ya están en producción.
