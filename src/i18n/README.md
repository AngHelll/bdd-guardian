# BDD Guardian – Internacionalización (i18n)

Los mensajes que ve el usuario (toasts, barra de estado, hover, etc.) se obtienen del módulo `i18n`. Idiomas soportados: **en** (inglés) y **es** (español).

## Cómo funciona

- **`messages.ts`**: Define los textos en `en` y `es`. Es la fuente usada en runtime.
- **`index.ts`**: Expone `t(key, ...args)` y elige el idioma según la configuración `bddGuardian.displayLanguage` o el idioma de VS Code.
- **`en.json` / `es.json`**: Copia de referencia de las claves (opcional para traductores).

## Uso en código

```ts
import { t } from '../i18n';

// Sin parámetros
vscode.window.showInformationMessage(t('ready'));

// Con parámetros {0}, {1}, ...
showMessage(t('noBindingForStep', stepText));
showMessage(t('statsMessage', String(features), String(steps), String(bindings)));
```

## Añadir un nuevo idioma

1. En `messages.ts`, añade un objeto `fr` (o el código de idioma) con las mismas claves que `en` y tradúcelas.
2. En `index.ts`, importa el nuevo objeto, añádelo a `bundles` y amplía el tipo `DisplayLanguage` y la lógica de `getDisplayLanguage()`.
3. En `package.json`, en la propiedad `bddGuardian.displayLanguage`, añade el nuevo valor al `enum` de la configuración.

## Añadir una nueva cadena

1. Añade la clave y el texto en inglés en `en` (y en `es` en español) en `messages.ts`.
2. Usa `t('nuevaClave')` o `t('nuevaClave', arg0, arg1)` donde corresponda.
