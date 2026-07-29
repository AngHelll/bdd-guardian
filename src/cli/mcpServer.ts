/**
 * Minimal MCP stdio server (JSON-RPC + Content-Length framing).
 * Tools dispatch via mcpTools — same builders as guardian-cli.
 */

import { MCP_TOOL_DESCRIPTORS, dispatchMcpTool } from './mcpTools';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'bdd-guardian', version: '1.8.0' };

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
    jsonrpc?: string;
    id?: JsonRpcId;
    method?: string;
    params?: Record<string, unknown>;
}

function writeMessage(message: unknown): void {
    const body = Buffer.from(JSON.stringify(message), 'utf8');
    process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
    process.stdout.write(body);
}

function respond(id: JsonRpcId | undefined, result: unknown): void {
    if (id === undefined) {
        return;
    }
    writeMessage({ jsonrpc: '2.0', id, result });
}

function respondError(id: JsonRpcId | undefined, code: number, message: string): void {
    if (id === undefined) {
        return;
    }
    writeMessage({ jsonrpc: '2.0', id, error: { code, message } });
}

function handleRequest(msg: JsonRpcRequest): void {
    const method = msg.method ?? '';
    const id = msg.id;
    const params = msg.params ?? {};

    try {
        switch (method) {
            case 'initialize':
                respond(id, {
                    protocolVersion: PROTOCOL_VERSION,
                    capabilities: { tools: {} },
                    serverInfo: SERVER_INFO,
                });
                return;
            case 'notifications/initialized':
            case 'initialized':
                return;
            case 'ping':
                respond(id, {});
                return;
            case 'tools/list':
                respond(id, { tools: MCP_TOOL_DESCRIPTORS });
                return;
            case 'tools/call': {
                const name = String(params.name ?? '');
                const args = (params.arguments as Record<string, unknown> | undefined) ?? {};
                const report = dispatchMcpTool(name, args);
                respond(id, {
                    content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
                    structuredContent: report,
                });
                return;
            }
            default:
                if (id !== undefined) {
                    respondError(id, -32601, `Method not found: ${method}`);
                }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (id !== undefined) {
            respond(id, {
                content: [{ type: 'text', text: `error: ${message}` }],
                isError: true,
            });
        }
    }
}

/**
 * Start MCP stdio read loop (blocks process on stdin).
 */
export function runMcpStdio(): void {
    let buffer = Buffer.alloc(0);

    process.stdin.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        let reading = true;
        while (reading) {
            const headerEnd = buffer.indexOf('\r\n\r\n');
            if (headerEnd < 0) {
                reading = false;
                break;
            }
            const header = buffer.slice(0, headerEnd).toString('utf8');
            const match = /Content-Length:\s*(\d+)/i.exec(header);
            if (!match) {
                buffer = buffer.slice(headerEnd + 4);
                continue;
            }
            const length = Number(match[1]);
            const bodyStart = headerEnd + 4;
            if (buffer.length < bodyStart + length) {
                reading = false;
                break;
            }
            const body = buffer.slice(bodyStart, bodyStart + length).toString('utf8');
            buffer = buffer.slice(bodyStart + length);
            try {
                const msg = JSON.parse(body) as JsonRpcRequest;
                handleRequest(msg);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                writeMessage({
                    jsonrpc: '2.0',
                    id: null,
                    error: { code: -32700, message: `Parse error: ${message}` },
                });
            }
        }
    });

    process.stdin.on('end', () => {
        process.exit(0);
    });
}
