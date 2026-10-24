/**
 * tsc does not emit the imported JSON next to the compiled parser.
 * The extension host and CLI load it from out/.
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/core/parsing/gherkin-languages.json');
const destDir = path.join(__dirname, '../out/core/parsing');
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, path.join(destDir, 'gherkin-languages.json'));
