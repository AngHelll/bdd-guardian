# Evidencia de proyecto y de carga de bindings

Lector estático de `.csproj` y `reqnroll.json`. No lo consulta `createResolver`, ni el mapa, ni los proveedores. No tiene un booleano `accessible`.

Tres relaciones conviven en cada proyecto y no se sustituyen:

| Relación | Tipo | Qué significa |
|---|---|---|
| Referencia de compilación | `ProjectReferenceEvidence` (`compile-reference`) | El `.csproj` apunta a otro archivo de proyecto. `resolved` solo dice que ese archivo existe. |
| Carga de bindings | `BindingAssemblyEvidence` (`binding-load`) | `reqnroll.json` nombra un ensamblado en `bindingAssemblies`. |
| Ensamblado de ejecución | `HostAssemblyEvidence` (`host-assembly`) | El ensamblado del propio proyecto. |

`ResolutionStatus` sigue siendo `resolved`, `inferred`, `unresolved` o `unknown`. En las propiedades MSBuild, `resolution` dice cómo se obtuvo el valor:

| resolution | status | Cuándo |
|---|---|---|
| `explicit` | `resolved` | Literal incondicional escrito en el `.csproj`. |
| `inherited` | `resolved` | Literal incondicional del `Directory.Build.props` más cercano, no sustituido por el `.csproj`. |
| `derived` | `inferred` | `AssemblyName` ausente y nada pendiente puede asignarlo. Sale del nombre del archivo, no de la carpeta. No es una observación de runtime. |
| `unknown` | `unknown` | Condición, `Choose`, import no leído, o un `Directory.Build.targets` que podría sobrescribir. |
| `unresolved` | `unresolved` | `$(...)` que no apunta a un literal ya conocido, función o transformación. |

Cada propiedad lleva `originPath`, `propertyName`, el texto crudo y, si hace falta, `detail`.

El orden estático es el del SDK: el `Directory.Build.props` más cercano (búsqueda hacia arriba, como `GetPathOfFileAbove`), después el `.csproj`. Una asignación posterior pisa a la anterior. Un `Directory.Build.props` más lejano no se importa. `Directory.Build.targets` se registra y no se lee; si existe, ningún valor queda definitivo.

## Ejemplo: lab E6

`loadProjectGraph` sobre `src/__tests__/fixtures/ownership/reqnroll-lab`.

Antes de leer props (fase 3A): `AssemblyName` y `TargetFramework` quedaban `unknown` en los tres proyectos, porque `Directory.Build.props` solo se detectaba.

Después:

```text
BindingLib.csproj
  assembly            derived BindingLib   (no hay AssemblyName declarado; nombre del archivo)
  targetFrameworks    inherited net8.0     (Directory.Build.props del lab)
  projectReferences   []
  reqnroll            absent
  bindingAssemblies   []
  hostAssembly        host-assembly, mismo nombre derivado

TestAlpha.csproj
  assembly            derived TestAlpha
  targetFrameworks    inherited net8.0
  projectReferences   compile-reference resolved → ../BindingLib/BindingLib.csproj
  reqnroll            present   TestAlpha/reqnroll.json
  bindingAssemblies   binding-load resolved "BindingLib"
  hostAssembly        host-assembly, nombre derivado TestAlpha
  no referencia a TestBeta

TestBeta.csproj
  misma forma que TestAlpha, hacia BindingLib
  assembly            derived TestBeta
  no referencia a TestAlpha
```

El `net8.0` es el literal del props, no una medición del runtime. El nombre derivado coincide con las DLL de la fase 2 (`TestAlpha.dll`, `TestBeta.dll`, `BindingLib.dll`) y sigue marcado como `derived`, no como hecho de ejecución. En BindingLib el nombre de la carpeta coincide con el del archivo; el caso `literal/src/App.csproj` separa carpeta `src`, archivo `App.csproj` y ensamblado heredado `Literal.Assembly`.

La cadena `"BindingLib"` del json y el archivo `BindingLib.csproj` no se unen con una arista. Son dos evidencias. En la fase 2, sin ese json el step compartido quedó undefined; con `bindingAssemblies` pasó. El grafo conserva las dos lecturas y no decide el step.

Si se lee el mismo `TestAlpha.csproj` inyectando configuración ausente, la `ProjectReference` sigue `resolved` y `bindingAssemblies` queda vacío.

## Comparación con Reqnroll 3.3.4

| Hecho del runtime (fase 2) | Qué dice el grafo |
|---|---|
| `ProjectReference` a BindingLib no carga el step compartido | Referencia de compilación `resolved`. Sin json, la lista de carga está vacía. |
| `bindingAssemblies: BindingLib` hace pasar el step compartido | Entrada `binding-load` con nombre resuelto. No se marca el step. |
| TestAlpha y TestBeta no se ven el `I ping` | No hay `ProjectReference` entre ellos. |
| `(\d+)` y `(.*)` siguen ambiguous en el mismo ensamblado | Fuera de este grafo. Sigue siendo asunto del matcher. |
| `[Given]` sin `[Binding]`, y `When` contra un `[Given]` | Fuera de este grafo. |
| TFM real `net8.0` y DLLs con el nombre del archivo | `TargetFramework` heredado `net8.0` desde el props. `AssemblyName` derivado del archivo, no declarado. |

## Limitaciones

- No se ejecuta MSBuild. No hay evaluador general.
- Se leen literales incondicionales del `Directory.Build.props` más cercano. Un `$(Nombre)` se expande solo si `Nombre` ya es un literal de ese conjunto.
- `Condition`, `Choose`/`When`, funciones `$([...])`, transformaciones `%(...)` y `@(...)` quedan sin valor definitivo.
- Un `<Import>` no se sigue, aunque el archivo exista y contenga literales. Lo que el import podría pisar queda `unknown`. Un literal escrito después del import sí se conserva.
- `Directory.Build.targets` no se lee. Si el más cercano existe, los valores dejan de ser definitivos.
- La búsqueda se detiene en la raíz pedida a `loadProjectGraph`. Un targets por encima de esa raíz no se ve.
- Si `AssemblyName` falta y queda algún import o targets sin evaluar, no se inventa el default. Si la cadena estática está cerrada, el default es el nombre del archivo y se marca `derived`.
- `$(MSBuildProjectName)`, `$(Configuration)` y el resto de propiedades reservadas o de entorno no se expanden.
- `TargetFramework` y `TargetFrameworks` a la vez quedan `unknown`. No se inventa un TFM.
- Dos literales incondicionales del mismo nombre: gana el último en el orden props y después csproj.
- `reqnroll.json` se busca solo junto al `.csproj`. Ausente, inválido y presente con lista vacía son estados distintos. Una entrada sin `assembly` queda `unknown` y no invalida el archivo.
- No se interpreta `path` dentro de `bindingAssemblies`, ni atributos de ensamblado, ni `PackageReference`.
- El grafo de proyectos no asigna archivos. La pertenencia está en `analyzeFileOwnership` y no modifica ese grafo.
- `loadProjectGraph` recibe una raíz. Un workspace multi-root sería la unión de varias llamadas. Esa unión no está hecha.
- Se omiten `bin`, `obj`, `node_modules` y el resto de directorios de salida que ya omite el CLI.

## Pertenencia de archivos

`analyzeFileOwnership(graph, files)` devuelve relaciones nuevas. No muta el grafo y no consulta el resolver. Un archivo tiene una sola identidad aunque varios proyectos lo citen. No hay un único `projectId`.

| kind | Confianza | Qué afirma |
|---|---|---|
| `explicit-compile-include` | `declared` | El `.csproj` o el props tienen un `Compile Include` literal. |
| `explicit-compile-remove` | `declared` | Hay un `Compile Remove` literal. No es un candidato por default. |
| `linked-compile-include` | `declared` | El `Compile Include` literal apunta fuera de la carpeta del proyecto. |
| `default-compile-candidate` | `convention` | Proyecto SDK, sin regla estática que lo excluya. No es un `Compile` confirmado. |
| `explicit-feature-include` | `declared` | Un item literal (`None`, `Content`, `EmbeddedResource`, `ReqnrollFeatureFiles`, `SpecFlowFeatureFiles`) nombra el `.feature`. |
| `feature-candidate` | `physical` | El `.feature` está en la carpeta. La participación en Reqnroll no está confirmada. |
| `directory-containment` | `physical` | El archivo está bajo la carpeta. No es compilación ni ejecución. |
| `unknown` | `none` | Glob, condición, import no leído, targets, o un `.csproj` que no parsea. |

Si no hay ninguna relación, `evidenceGap` lo dice. La lista vacía no prueba que el archivo no pertenezca a ningún proyecto.

Un proyecto anidado no gana por cercanía: el archivo bajo `inner/` queda relacionado con el proyecto exterior y con el interior. Un `Compile Remove` literal impide el candidato por default. `EnableDefaultCompileItems` en `false`, o un proyecto sin SDK, dejan solo la contención física.

### E6

| Archivo | Relaciones |
|---|---|
| `BindingLib/SharedSteps.cs` | contención y candidato por default de BindingLib. No aparece en TestAlpha ni TestBeta. |
| `TestAlpha/Steps.cs` | contención y candidato por default de TestAlpha. |
| `TestBeta/Steps.cs` | igual, solo TestBeta. |
| `TestAlpha/Features/ping.feature` | contención y `feature-candidate` de TestAlpha. No es un `Compile`. No es de TestBeta. |
| `TestBeta/Features/ping.feature` | otra identidad, solo TestBeta. |

La `ProjectReference` de TestAlpha hacia BindingLib no copia la pertenencia de `SharedSteps.cs`. `bindingAssemblies` tampoco. Esas relaciones del grafo quedan como estaban.

### Matriz

| Caso | Resultado |
|---|---|
| `Compile Include` literal dentro del proyecto | `explicit-compile-include`, `resolved` |
| `Compile Remove` literal | `explicit-compile-remove`, sin candidato por default |
| Include fuera de la carpeta | `linked-compile-include` |
| Dos proyectos incluyen el mismo archivo | una identidad, dos relaciones |
| Archivo bajo un proyecto anidado | candidatos del exterior y del interior |
| Sin `.csproj` | sin relaciones y `evidenceGap` |
| Glob `**\*.cs` | `unknown`, glob sin expandir |
| `Condition` en el item | `unknown` |
| `<Import>` no evaluado | `unknown`, sin candidato por default |
| `.feature` solo presente en la carpeta | `feature-candidate`, no participación confirmada |
| `.feature` nombrado por un `None` literal | `explicit-feature-include` más el candidato |
| `EnableDefaultCompileItems` false, o proyecto sin SDK | solo contención |
| `.csproj` ilegible | contención y `unknown` |

### Límites de la pertenencia

- No se expanden globs ni se ejecuta MSBuild. Un glob que apunte fuera del proyecto no se asocia a archivos externos.
- El default SDK no se aplica si hay un `Directory.Build.targets`, un `<Import>`, un `Compile` con glob o con propiedad dinámica, o si `EnableDefaultCompileItems` no se puede leer.
- Una condición sobre un archivo concreto deja ese archivo en `unknown` y no lo marca como candidato por default.
- Reqnroll mete los `.feature` desde targets del paquete que este lector no abre. Por eso la carpeta solo produce `feature-candidate`.
- `bin/` y `obj/` no reciben candidato por default. La contención física sí puede existir.
- Esto no dice qué bindings carga el runner.

## Diagnóstico complementario

`explainStep` copia el `status` del resolver y añade explicaciones. No cambia candidatos, no lee `preferSpecificBinding` y no ejecuta el runner. `runtimeConfirmed` es siempre `false`.

| Escenario | Resolver | Explicación | Runtime ya observado | Sigue faltando |
|---|---|---|---|---|
| E2, dos patrones en TestAlpha | ambiguous | `same-project-overlap`, confianza de convención SDK | `AmbiguousBindingException` | Un `Compile` explícito. Esta capa no reejecuta el runtime |
| E6, `I ping` en Alpha y Beta | ambiguous | `cross-project-candidates`. Los dos candidatos se conservan | Cada proyecto pasó su ping por separado | Prueba de que el runner no ve al otro. La convención no basta |
| E6, reloj con `bindingAssemblies` | bound | `binding-load-evidence`. El nombre igual al archivo es `derived-file-name`, no prueba de carga | El step pasó con el json | Confirmar el ensamblado cargado, no el string |
| E6, solo `ProjectReference` | bound | La referencia se cita como compilación, no como `bindingAssemblies` | Sin json el step quedó undefined | No convertir esta explicación en unbound |
| Archivo presente, default de compile apagado | bound | `insufficient-ownership-evidence` | No ejecutado | No tratar la presencia del archivo como binding ejecutable |
| Archivo bajo dos proyectos | bound | `unresolved-project-context` con los dos proyectos | No ejecutado | No elegir el más cercano |
| E1 y E3, sin manifiesto | ambiguous / unbound | `unresolved-project-context`. No se fabrica un proyecto por carpeta | E1 no ejecutado | Un manifiesto, o dejarlo incierto |
| E5, Godog y Cucumber.js | bound | El otro archivo queda citado. No se declara inaccesible | No ejecutado | Un modelo de proyecto para esos frameworks |
| E7, step sin tag | unbound | `scope-not-selected`. No se promueve a bound | El runtime nombró los dos métodos fuera de scope | La comparación aquí es textual, no el regex del resolver |
| Keyword `When` contra un `[Given]` | unbound. El fallback ya no selecciona el `[Given]` | Sin explicación de fallback | El runtime lo dejó undefined | El runner no se reejecutó en esta fase |

E8 no tiene proyecto. Un binding sintético cae en contexto sin resolver. El conteo de huérfanos no entra en esta capa.

### Evidencia suficiente para mostrar, todavía no para filtrar

- Dos candidatos con evidencia de compilación en el mismo proyecto (`same-project-overlap`).
- Una entrada real de `bindingAssemblies`, citada con su archivo, sin dar la igualdad de nombre por carga.
- Un `ProjectReference` citado como compilación y no como carga.
- Un scope no seleccionado, como dato del resultado actual. Un `When` contra un `[Given]` ya no es un candidato.

### Debe permanecer incierto

- Carpetas sin manifiesto.
- Candidato solo con contención física o con `unknown`.
- Nombre de ensamblado `derived`.
- Archivo compartido por dos proyectos.
- Otro framework sin grafo.
- Cualquier accesibilidad de runtime.

### Riesgo de un falso diagnóstico

Mostrar `cross-project-candidates` como “este step no es ambiguo” ocultaría un binding que el runner sí podría cargar. Mostrar `binding-load-evidence` como “está cargado” repetiría el error de confundir un string con el proceso. Mostrar `scope-not-selected` como bound ignoraría que el resolver ya excluyó esos bindings. `preferSpecificBinding` no aporta evidencia de accesibilidad.

### Recomendación

**NO-GO** para integración visual y para filtrado. La capa distingue hipótesis con procedencia, y en los casos fuertes (mismo proyecto, referencia frente a `bindingAssemblies`) la distinción es real. Aún así la mayoría de las señales son convención o ausencia de datos. Una UI que las convierta en otro estado del step produciría diagnósticos falsos. El siguiente paso, si se aprueba, es solo una vista de solo lectura que deje el status actual intacto.

## Integración futura, sin hacerla

Usar estas relaciones como filtro de candidatos puede convertir evidencia incompleta en diagnósticos falsos. `feature-candidate` y `default-compile-candidate` no alcanzan para ocultar un binding. `unknown` y `evidenceGap` no pueden mostrarse como cero huérfanos ni como unbound.

La carga de bindings sigue siendo la lista `binding-load` más el ensamblado host. La pertenencia de `SharedSteps.cs` a BindingLib no lo hace visible en TestAlpha: en el runtime hizo falta `bindingAssemblies`.

Si más adelante hay un filtro, tiene que ser explícito y su default el workspace entero. `preferSpecificBinding` no sustituye ese filtro.

## Decisiones pendientes

- Seguir o no un `<Import>` cuyo `Project` sea una ruta literal, sin convertirse en un evaluador MSBuild.
- Crear o no una arista inferida cuando el nombre de `bindingAssemblies` coincide con el `AssemblyName` de otro proyecto. El nombre derivado no basta para esa arista.
- Cuándo mostrar el grafo y la pertenencia en el mapa, sin convertir contención, candidatos o `unknown` en bound, unbound o ambiguous.
- Si un `feature-candidate` debe seguir siendo solo físico hasta leer los targets de Reqnroll.
