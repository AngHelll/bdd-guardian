#!/usr/bin/env node
/**
 * BDD Guardian headless CLI — discover / analyze (no Extension Host).
 */
'use strict';

require('./install-vscode-shim');

const path = require('path');
const fs = require('fs');

const mainPath = path.join(__dirname, '..', 'out', 'cli', 'main.js');
if (!fs.existsSync(mainPath)) {
    console.error('error: compiled CLI missing — run npm run compile first');
    console.error(`  expected: ${mainPath}`);
    process.exit(1);
}

const { runCli } = require(mainPath);
process.exit(runCli(process.argv.slice(2)));
