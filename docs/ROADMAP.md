# BDD Guardian – Roadmap

Mejoras y features alineados con la esencia del proyecto: **navegar y validar pasos BDD** entre Gherkin y step definitions (Reqnroll, SpecFlow, Cucumber, etc.).

---

## Hecho (multi-framework)

- **Go to Step Usage / Show Binding Usages:** CodeLens en archivos de bindings (C#, TypeScript, JavaScript, Python, Go) muestra “→ N usages”. Un clic abre el step en el .feature o un QuickPick con todos los usos. Usa el índice y el resolver del core, así que funciona con cualquier provider (Reqnroll, SpecFlow, y futuros Cucumber.js, Behave, etc.).
- **Feedback de indexado:** Status bar muestra “BDD Guardian: Indexing…” durante el indexado y “BDD Guardian: Ready” al terminar.

---

## Prioridad alta (cerrar gaps y pulir)

### 3. Mejorar manejo de regex complejos ✅ (parcial)
- **Hecho:** Literal `$`/`^` escapados (sin romper `[^"]`), flag `u`, fallback a match exacto si el patrón no compila. C# verbatim con `""` en el patrón (p. ej. `they click on ""(.*)"" in the menu`) se extrae correctamente. Ver `src/core/parsing/bindingRegex.ts`.
- **Opcional:** Normalización de espacios en patrón, `countCaptureGroups` para `[...]`.
- **Estado (resto):** “Some complex regex patterns may not match correctly” en Known Issues.
- **Acción:** Revisar casos límite en `bindingRegex.ts` y tests con patrones reales (alternativas `|`, grupos, cuantificadores). Documentar limitaciones o añadir fallback (p. ej. match por texto normalizado si el regex falla).
- **Beneficio:** Menos pasos “unbound” falsos y más confianza en el matching.

---

## Prioridad media (más valor, misma esencia)

### 4. Más frameworks (Cucumber JS, Behave, etc.)
- **Estado:** Stubs en `jsCucumberProvider`, `pythonBehaveProvider`, `goGodogProvider`, etc. con TODOs; C# Reqnroll y SpecFlow completos.
- **Orden sugerido:** Cucumber JS (muy usado) → Behave (Python) → Godog (Go). Ver `docs/PROVIDERS.md` para implementar cada uno (detección + parsing de bindings).
- **Beneficio:** Misma experiencia de navegación y diagnósticos para proyectos JS/TS, Python y Go.

### 5. Find All References
- **Sobre un step** en un .feature: “Find All References” → lista de archivos .feature y escenarios que usan el mismo texto (o el mismo binding).
- **Sobre un binding** en .cs: ya lo cubre “Show Binding Usages”; se puede exponer también como ReferenceProvider para que Shift+F12 muestre los mismos resultados.
- **Beneficio:** Refactor seguro y exploración de uso de pasos.

### 6. Coach: más reglas y quick fixes
- **Reglas posibles:** “Un Then por escenario” (o marcar cuando hay varios), “Pasos en imperativo” (evitar “User clicks” → “User click” o redacción en tercera persona), “Tag vacío o redundante”.
- **Quick fixes:** Ampliar los existentes (p. ej. sugerir reemplazo de texto para “vague then”, o dividir escenario cuando hay “too many steps”).
- **Beneficio:** Mejor calidad de .feature sin salir del editor.

### 7. Autocompletado de pasos
- **En archivos .feature:** Al escribir después de Given/When/Then, sugerir textos de pasos que ya existen (desde bindings indexados) para reutilizar y mantener consistencia.
- **Beneficio:** Menos pasos duplicados y menos typos; encaja con “guardar” la consistencia BDD.

---

## Prioridad baja / futuro

### 8. Generar binding desde el step
- **Idea:** Acción tipo “Generate step definition” sobre un step unbound: generar el método C# (o otro lenguaje cuando haya provider) con el patrón sugerido y abrir el archivo.
- **Nota:** Ya está en [Unreleased] del CHANGELOG.

### 9. Copy as pattern
- **Idea:** Comando o Code Action en un step: “Copy as C# pattern” para pegar en un atributo `[Given("...")]` (escapado y con placeholders si aplica).

### 10. Mejor onboarding
- **Idea:** Cuando no se detecten bindings (o no haya .feature), un mensaje o panel breve: “BDD Guardian works best with Reqnroll/SpecFlow projects. Open a folder with .feature and .cs bindings,” con enlace a la doc.
- **En README/Marketplace:** GIF o vídeo corto mostrando CodeLens, Go to Definition y Coach.

---

## Resumen por impacto

| Área              | Mejora                                      | Esencia        |
|-------------------|---------------------------------------------|-----------------|
| Navegación        | Step usage desde .cs + Find References      | ✅ Core         |
| Frameworks        | Cucumber JS, Behave, Godog                   | ✅ Extensión    |
| Rendimiento       | Progreso de indexado, no bloquear            | ✅ Confianza    |
| Matching          | Regex complejos, edge cases                   | ✅ Precisión    |
| Coach             | Más reglas y quick fixes                     | ✅ Calidad BDD  |
| Productividad     | Autocompletado, generar binding, copy pattern| ✅ Flujo        |

Recomendación: empezar por **1** (cerrar el gap de Step Usage) y **2** (feedback de indexado); luego **4** (un framework no-C#) o **5** (Find All References) según lo que prefieras para la siguiente versión.
