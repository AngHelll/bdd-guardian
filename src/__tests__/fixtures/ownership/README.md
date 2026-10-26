# Ownership fixtures (fase 2)

Las pruebas de Vitest fijan el comportamiento **actual** de Guardian. No leen `reqnroll.json` y no filtran por carpeta. La sección de runtime es una ejecución aparte de Reqnroll 3.3.4. Lo que no se ejecutó sigue marcado como hipótesis.

## Fixtures

| Id | Archivos | Guardian, observado por `ownershipFixtures.test.ts` | Runtime |
|---|---|---|---|
| E1 | `e1-duplicate-pattern/` sin `.csproj` | Cada carpeta sola: bound. Las dos juntas: ambiguous, métodos `GivenIPingFromA` y `GivenIPingFromB` | No ejecutado. No hay proyecto .NET |
| E2 | `reqnroll-lab/TestAlpha` overlap | ambiguous. Con `preferSpecificBinding: true`, bound a `GivenIHaveEnteredNumeric` | Verificado: `AmbiguousBindingException` con los dos métodos de `OverlapSteps` |
| E3 | `e3-no-bindings/lonely.feature` | 3 unbound, 0 bindings, 0 orphan, escaneo completo | No ejecutado |
| E4 | `BindingLib/SharedSteps.cs` y los dos `shared.feature` | 2 bound al mismo método. 0 orphan | Ver tabla de runtime. El archivo solo no basta |
| E5 | `e5-frameworks/` Godog + Cucumber.js, textos distintos | 2 bound, 0 ambiguous | No ejecutado. No son proyectos .NET |
| E6 | `reqnroll-lab/` completo | El reloj compartido queda bound. `I ping 3` queda ambiguous entre Alpha y Beta. El atributo suelto queda bound | Ver tabla. `ProjectReference` no publica bindings. `bindingAssemblies` sí |
| E7 | `scope.feature` + `ScopeSteps` | `@web` → `LoginWeb`, `@api` → `LoginApi`, sin tag → unbound | Verificado, mismo corte |
| E8 | 2 001 bindings en memoria | `orphanScan: skipped`. El número heredado sigue en 0 y no se muestra. Con el escaneo forzado, el conteo es 2 000 y la lista visible se corta en 500. Con 2 000 justos el escaneo sí corre | No aplica |

`samples/binding-demo` sigue en 38 steps, 26 bindings, 25 bound, 1 unbound, 12 ambiguous, 2 orphan.

## Runtime

Entorno: SDK `10.0.300`, TFM `net8.0`, Reqnroll `3.3.4`, Reqnroll.xUnit `3.3.4`, xunit `2.8.1`, xunit.runner.visualstudio `2.8.2`, Microsoft.NET.Test.Sdk `17.14.1`. Esas versiones ya estaban en la caché de NuGet. El primer `dotnet restore` dentro del sandbox falló por el proxy (`403`). El restore que compiló se hizo fuera del sandbox, contra esa caché. No se añadió un feed nuevo.

```bash
dotnet test src/__tests__/fixtures/ownership/reqnroll-lab/TestAlpha/TestAlpha.csproj --no-restore
dotnet test src/__tests__/fixtures/ownership/reqnroll-lab/TestBeta/TestBeta.csproj --no-restore
```

`Directory.Build.props` pone el code-behind de Reqnroll en `obj/`. `bin/` y `obj/` ya están en `.gitignore`.

### Sin `reqnroll.json`

Primera ejecución, solo con `ProjectReference` a `BindingLib`.

| Escenario | Proyecto | Resultado |
|---|---|---|
| Shared clock is visible | TestAlpha y TestBeta | undefined. El mensaje pide crear `[Given("the shared clock shows {int}")]`. La librería no entra sola |
| Local ping stays in this project | TestAlpha y TestBeta | Passed. El ping del otro proyecto no lo vuelve ambiguous |
| Overlapping patterns collide | TestAlpha | `AmbiguousBindingException`: `GivenIHaveEnteredNumeric` y `GivenIHaveEnteredAnything` |
| Loose attribute is not a binding | TestAlpha | undefined |
| Keyword does not cross | TestAlpha | undefined. Sugiere un `[When]`, no reutiliza el `[Given]` |
| Web scope matches | TestAlpha | Passed |
| Api scope matches | TestAlpha | Passed |
| Bare scope matches nothing | TestAlpha | undefined. El mensaje nombra `LoginWeb` y `LoginApi` y dice que el scope no coincide |

### Con `bindingAssemblies`

Los `reqnroll.json` actuales declaran el ensamblado `BindingLib`. Segunda ejecución:

| Escenario | Resultado |
|---|---|
| Shared clock is visible | Passed en TestAlpha y en TestBeta |
| El resto | Igual que la tabla anterior |

TestAlpha quedó en 4 passed / 4 failed. TestBeta quedó en 2 passed. Esos failed son los casos que el runtime rechaza a propósito.

## Matriz Guardian frente a Reqnroll

| Caso | Guardian ahora | Reqnroll 3.3.4 en este lab |
|---|---|---|
| `(\d+)` y `(.*)` en el mismo ensamblado | ambiguous | AmbiguousBindingException |
| El mismo patrón copiado en TestAlpha y TestBeta | ambiguous al juntar los archivos | Passed en cada proyecto. No se ven entre sí |
| `BindingLib` referenciado y sin `bindingAssemblies` | bound. Basta el `.cs` en el pool | undefined |
| `BindingLib` nombrado en `bindingAssemblies` | bound. El resolver no lee el json | Passed |
| `[Given]` en una clase sin `[Binding]` | bound | undefined |
| `When` con solo un `[Given]` del mismo texto | unbound. Antes quedaba bound con `keywordMatched: false` | undefined |
| `Scope(Tag)` web, api y sin tag | bound, bound, unbound | Passed, Passed, undefined nombrando los dos scopes |
| `preferSpecificBinding: true` en E2 | bound al `(\d+)` | No existe ese ajuste. El caso siguió ambiguous |

E1, E3 y E5 no tienen fila de runtime.

### Semántica de binding y de keyword

Segunda ejecución de esta fase, sobre el mismo laboratorio restaurado. No hubo restore ni paquetes nuevos. `dotnet test TestAlpha.csproj --no-restore` pasó de 8 a 24 escenarios: los 4 passed y los 4 failed anteriores se conservan, y `semantics.feature` añade 13 passed y 3 failed. El filtro `SemanticCompatibility` dio 13 passed / 3 failed.

| Escenario | Guardian ahora | Reqnroll 3.3.4 |
|---|---|---|
| Clase con `[Binding]` | bound | Passed |
| Clase con `[Reqnroll.Binding]` y `[Given]` sin prefijo | bound. El parser no lee el atributo de clase | Passed |
| `[Reqnroll.Given]`, `[Reqnroll.GivenAttribute]`, `[global::Reqnroll.Given]` | bound. Antes el regex no los veía | Passed los tres |
| Clase anidada pública con `[Binding]` | bound. El nombre de clase que asigna es `NestedBinding` | Passed |
| Clase anidada privada con `[Binding]` | bound | Passed |
| Método de la clase exterior después de una anidada sin `[Binding]` | bound. Lo atribuye a `HelperWithoutBinding` | Passed. El `[Binding]` de la clase exterior basta |
| Método de una clase sin `[Binding]`, declarado después de una anidada que sí lo tiene | bound. Lo atribuye a `InnerOnly` | undefined |
| `partial` con `[Binding]` en otra parte del mismo proyecto | bound, aunque esa parte no tiene `[Binding]` | Passed |
| `partial` sin `[Binding]` en ninguna parte | bound | undefined |
| `And` y `But` después de `Given`, con `[Given]` | bound, `keywordResolved: Given`, `keywordMatched: true` | Passed |
| `And` y `But` después de `When`, con `[When]` | bound, `keywordResolved: When`, `keywordMatched: true` | Passed |
| `And` después de `When` con solo un `[Given]` | unbound. El keyword efectivo sigue siendo `When`. Antes quedaba bound con `keywordMatched: false` | undefined. El mensaje pide un `[When]`. El `When` anterior sí ejecutó |
| `*` después de `Given`, y `*` al abrir el escenario | bound, `keywordResolved: Given` | Passed los dos |
| `When` con solo un `[Given]` | unbound. Antes, el fallback lo dejaba bound | undefined. Resultado previo, repetido en la misma ejecución |

`binding-demo` no tiene ningún step resuelto solo por el fallback: sigue en 25 bound, 1 unbound, 12 ambiguous.

Cucumber, Godog, Behave y pytest-bdd no se ejecutaron.

## Contrato de pertenencia propuesto

No está cableado al resolver. Un archivo puede tener más de un dueño.

```text
Workspace
  roots[]                          carpetas multi-root de VS Code

ProjectIdentity
  id                               ruta del manifiesto, o "unmanifested:<carpeta>"
  kind                             csproj | pom | go.mod | package.json | pyproject | unmanifested
  frameworkHints[]                 provider id, con la evidencia (PackageReference, import)
  assemblyName?                    solo si el manifiesto lo declara

FileOwnership
  file
  owners[]                         lista, no un único id
  evidence                         manifest-include | directory-contains | inferred-nearest | unknown
  confidence                       high | low

BindingAccessibility
  bindingFile
  visibleTo[]                      ProjectIdentity que el runner cargaría
  evidence                         same-assembly | binding-assemblies-config | project-reference-only | source-present
```

Reglas que este lab ya obliga a respetar:

- `project-reference-only` no es visibilidad de binding en Reqnroll 3.3.4. La visibilidad comprobada es el ensamblado del test más `bindingAssemblies`.
- Dos `.csproj` sin referencia mutua son dos ensamblados. Guardian hoy los junta por estar en el mismo workspace.
- Una carpeta sin manifiesto (E1, E3) tiene dueño `unmanifested`. No se le inventa un ensamblado.
- Godog y Cucumber.js en el mismo workspace no comparten ensamblado. El choque solo aparece si los patrones coinciden.
- El proveedor sigue siendo un dato del binding. No es el dueño del archivo.

## Pipeline conceptual

El orden propuesto, sin cambiar el comportamiento actual:

1. Descubrimiento de archivos, como hoy (`findFiles`).
2. Evidencia de pertenencia y de accesibilidad. Sale al lado del índice. No elimina candidatos.
3. Compilación del patrón, como hoy.
4. Scope de tags, como hoy (`isBindingInScope`).
5. Evaluación del regex, como hoy (`tryMatch`).
6. Clasificación bound / unbound / ambiguous / orphan, como hoy.

Un filtro de contexto, el día que se active, iría entre 2 y 5 y tendría default “workspace entero”, que es el resultado que estas pruebas fijan. `preferSpecificBinding` no es ese filtro: en E2 esconde una ambigüedad que Reqnroll conserva.

## `orphansSkipped`

`orphanScan` es `complete`, `skipped` o `unavailable`. El número `counts.orphanBindings` sigue existiendo: el JSON de `analyze` (`schemaVersion` 1) no admite `null`. Ese número solo es una medición cuando el estado es `complete`. Si el escaneo se omite o no está disponible, queda en 0 y el mapa no lo imprime. `orphansSkipped` sigue en true únicamente para `skipped`. La lista visible sigue cortada en 500.

## Primer incremento, cuando se apruebe

Un lector puro del grafo de E6: `.csproj` `ProjectReference` y `reqnroll.json` `bindingAssemblies`, con pruebas sobre este lab. No lo llama `createResolver`. Sirve para mostrar “compilado junto a” y “cargado por el runner” como hechos distintos. No se filtra por carpeta padre.

El rótulo de huérfanos ya no imprime 0 cuando el escaneo no se completó. No altera el match.
