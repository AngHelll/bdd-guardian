/**
 * VS Code API Mock for testing
 * Provides minimal mocks needed for pure logic testing
 */

export class Uri {
  static file(path: string): Uri {
    return new Uri(path);
  }
  
  static parse(value: string): Uri {
    return new Uri(value);
  }
  
  constructor(public readonly fsPath: string) {}
  
  toString(): string {
    return this.fsPath;
  }
}

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}
}

export class Range {
  constructor(
    public readonly start: Position | number,
    public readonly end: Position | number,
    startChar?: number,
    endChar?: number
  ) {
    if (typeof start === 'number' && typeof end === 'number') {
      this.start = new Position(start, startChar ?? 0);
      this.end = new Position(end, endChar ?? 0);
    }
  }
}

export class Location {
  constructor(
    public readonly uri: Uri,
    public readonly range: Range
  ) {}
}

export interface TextDocument {
  uri: Uri;
  fileName: string;
  getText(): string;
  lineAt(line: number): { text: string };
  lineCount: number;
}

export function createMockDocument(content: string, fileName: string): TextDocument {
  const lines = content.split('\n');
  return {
    uri: Uri.file(fileName),
    fileName,
    getText: () => content,
    lineAt: (line: number) => ({ text: lines[line] || '' }),
    lineCount: lines.length,
  };
}

// Workspace mock
export const workspace = {
  workspaceFolders: [],
  findFiles: async () => [],
  openTextDocument: async (uri: Uri) => createMockDocument('', uri.fsPath),
  getConfiguration: () => ({
    get: (key: string, defaultValue: any) => defaultValue,
  }),
};

// Window mock
export const window = {
  createOutputChannel: () => ({
    appendLine: () => {},
    show: () => {},
    dispose: () => {},
  }),
  showInformationMessage: () => {},
  showErrorMessage: () => {},
};

// Languages mock
export const languages = {
  registerDefinitionProvider: () => ({ dispose: () => {} }),
  registerHoverProvider: () => ({ dispose: () => {} }),
  registerCodeLensProvider: () => ({ dispose: () => {} }),
};

export default {
  Uri,
  Position,
  Range,
  Location,
  workspace,
  window,
  languages,
};
