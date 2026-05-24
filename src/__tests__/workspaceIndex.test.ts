import { describe, it, expect, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { WorkspaceIndex } from '../core/index/workspaceIndex';
import type { Binding } from '../core/domain/types';

function makeBinding(uri: vscode.Uri, line: number, methodName: string): Binding {
    return {
        uri,
        lineNumber: line,
        range: new vscode.Range(line, 0, line, 0),
        className: 'Steps',
        methodName,
        signature: `Steps.${methodName}`,
        keyword: 'Given',
        patternRaw: 'test',
        regex: /^test$/u,
    };
}

describe('WorkspaceIndex', () => {
    let index: WorkspaceIndex;
    const fileUri = vscode.Uri.file('/proj/Steps.cs');

    beforeEach(() => {
        index = new WorkspaceIndex();
    });

    it('removeBindingsForUri clears bindings added only via addBindings', () => {
        const b1 = makeBinding(fileUri, 10, 'StepOne');
        const b2 = makeBinding(fileUri, 20, 'StepTwo');

        index.addBindings([b1, b2], 'reqnroll');
        expect(index.getAllBindings()).toHaveLength(2);

        index.removeBindingsForUri(fileUri);
        expect(index.getAllBindings()).toHaveLength(0);
        expect(index.getBindingsByProvider('reqnroll')).toHaveLength(0);
    });

    it('re-adding bindings for the same file does not accumulate duplicates', () => {
        const b1 = makeBinding(fileUri, 10, 'StepOne');

        index.addBindings([b1], 'reqnroll');
        index.removeBindingsForUri(fileUri);
        index.addBindings([b1], 'reqnroll');

        expect(index.getAllBindings()).toHaveLength(1);
    });
});
