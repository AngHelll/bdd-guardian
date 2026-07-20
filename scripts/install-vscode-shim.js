/**
 * Install a CommonJS `vscode` shim so compiled core modules load outside Extension Host.
 */
'use strict';

const Module = require('module');
const shim = require('./vscode-shim');

const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') {
        return shim;
    }
    return originalRequire.apply(this, arguments);
};
