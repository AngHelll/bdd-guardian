#!/usr/bin/env node
/**
 * BDD Guardian MCP stdio server — discover / analyze / resolve-step / coach-analyze.
 */
'use strict';

require('./install-vscode-shim');

const path = require('path');
const fs = require('fs');

const serverPath = path.join(__dirname, '..', 'out', 'cli', 'mcpServer.js');
if (!fs.existsSync(serverPath)) {
    console.error('error: compiled MCP server missing — run npm run compile first');
    console.error(`  expected: ${serverPath}`);
    process.exit(1);
}

const { runMcpStdio } = require(serverPath);
runMcpStdio();
