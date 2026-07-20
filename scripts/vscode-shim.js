/**
 * Minimal vscode shim for guardian-cli (CommonJS).
 */
'use strict';

class Uri {
    static file(p) {
        return new Uri(p);
    }
    static parse(value) {
        return new Uri(value);
    }
    constructor(fsPath) {
        this.fsPath = fsPath;
        this.scheme = 'file';
        this.path = fsPath;
    }
    toString() {
        return this.fsPath;
    }
}

class Position {
    constructor(line, character) {
        this.line = line;
        this.character = character;
    }
}

class Range {
    constructor(start, end, startChar, endChar) {
        if (typeof start === 'number' && typeof end === 'number') {
            this.start = new Position(start, startChar ?? 0);
            this.end = new Position(end, endChar ?? 0);
        } else {
            this.start = start;
            this.end = end;
        }
    }
}

class Location {
    constructor(uri, range) {
        this.uri = uri;
        this.range = range;
    }
}

module.exports = {
    Uri,
    Position,
    Range,
    Location,
    workspace: {
        workspaceFolders: [],
        getConfiguration: () => ({ get: (_k, d) => d }),
    },
    window: {
        createOutputChannel: () => ({
            appendLine: () => {},
            show: () => {},
            dispose: () => {},
        }),
    },
};
