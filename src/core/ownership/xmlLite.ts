/**
 * Minimal XML reader for SDK-style project files.
 * Comments, the XML declaration, and the five predefined entities are handled.
 * Namespaces, CDATA, and DTD subsets are rejected.
 */

export interface XmlElement {
    readonly name: string;
    readonly attributes: Readonly<Record<string, string>>;
    readonly children: readonly XmlElement[];
    readonly text: string;
}

interface MutableElement {
    name: string;
    attributes: Record<string, string>;
    children: MutableElement[];
    text: string;
}

export interface XmlParseResult {
    readonly root: XmlElement | null;
    readonly error: string | null;
}

export function parseXmlDocument(source: string): XmlParseResult {
    const text = stripBom(source);
    const stack: MutableElement[] = [
        { name: '#document', attributes: {}, children: [], text: '' },
    ];
    let index = 0;

    while (index < text.length) {
        if (text.startsWith('<?', index)) {
            const end = text.indexOf('?>', index + 2);
            if (end < 0) {
                return fail('Unclosed XML declaration');
            }
            index = end + 2;
            continue;
        }
        if (text.startsWith('<!--', index)) {
            const end = text.indexOf('-->', index + 4);
            if (end < 0) {
                return fail('Unclosed XML comment');
            }
            index = end + 3;
            continue;
        }
        if (text.startsWith('<!', index)) {
            return fail('DTD and CDATA sections are not read');
        }
        if (text.startsWith('</', index)) {
            const close = readEndTag(text, index);
            if (close.error) {
                return fail(close.error);
            }
            const current = stack[stack.length - 1];
            if (!current || current.name !== close.name) {
                return fail(`End tag </${close.name}> does not match <${current?.name ?? '?'}>`);
            }
            if (stack.length === 1) {
                return fail('Unexpected end tag');
            }
            stack.pop();
            index = close.next;
            continue;
        }
        if (text[index] === '<') {
            const opened = readStartTag(text, index);
            if (opened.error || !opened.element) {
                return fail(opened.error ?? 'Invalid start tag');
            }
            stack[stack.length - 1].children.push(opened.element);
            if (!opened.selfClosing) {
                stack.push(opened.element);
            }
            index = opened.next;
            continue;
        }

        const nextTag = text.indexOf('<', index);
        const raw = nextTag < 0 ? text.slice(index) : text.slice(index, nextTag);
        stack[stack.length - 1].text += decodeXml(raw);
        index = nextTag < 0 ? text.length : nextTag;
    }

    if (stack.length !== 1) {
        return fail(`Unclosed element <${stack[stack.length - 1].name}>`);
    }
    const top = stack[0].children;
    if (top.length !== 1) {
        return fail(top.length === 0 ? 'XML document is empty' : 'XML document has more than one root');
    }
    return { root: freeze(top[0]), error: null };
}

function fail(error: string): XmlParseResult {
    return { root: null, error };
}

function freeze(element: MutableElement): XmlElement {
    return {
        name: element.name,
        attributes: element.attributes,
        children: element.children.map(freeze),
        text: element.text,
    };
}

function readStartTag(
    text: string,
    start: number
): { element: MutableElement | null; selfClosing: boolean; next: number; error: string | null } {
    let index = start + 1;
    const name = readName(text, index);
    if (!name) {
        return { element: null, selfClosing: false, next: start, error: 'Missing element name' };
    }
    index += name.length;
    const attributes: Record<string, string> = {};

    while (index < text.length) {
        index = skipSpace(text, index);
        if (text.startsWith('/>', index)) {
            return {
                element: { name, attributes, children: [], text: '' },
                selfClosing: true,
                next: index + 2,
                error: null,
            };
        }
        if (text[index] === '>') {
            return {
                element: { name, attributes, children: [], text: '' },
                selfClosing: false,
                next: index + 1,
                error: null,
            };
        }
        const attr = readAttribute(text, index);
        if (attr.error || !attr.name) {
            return { element: null, selfClosing: false, next: index, error: attr.error ?? 'Invalid attribute' };
        }
        attributes[attr.name] = attr.value;
        index = attr.next;
    }
    return { element: null, selfClosing: false, next: start, error: `Unclosed start tag <${name}>` };
}

function readEndTag(text: string, start: number): { name: string; next: number; error: string | null } {
    const name = readName(text, start + 2);
    if (!name) {
        return { name: '', next: start, error: 'Missing end tag name' };
    }
    const index = skipSpace(text, start + 2 + name.length);
    if (text[index] !== '>') {
        return { name, next: index, error: `End tag </${name}> is not closed` };
    }
    return { name, next: index + 1, error: null };
}

function readAttribute(
    text: string,
    start: number
): { name: string | null; value: string; next: number; error: string | null } {
    const name = readName(text, start);
    if (!name) {
        return { name: null, value: '', next: start, error: 'Missing attribute name' };
    }
    let index = skipSpace(text, start + name.length);
    if (text[index] !== '=') {
        return { name, value: '', next: index, error: `Attribute ${name} has no value` };
    }
    index = skipSpace(text, index + 1);
    const quote = text[index];
    if (quote !== '"' && quote !== "'") {
        return { name, value: '', next: index, error: `Attribute ${name} is not quoted` };
    }
    const end = text.indexOf(quote, index + 1);
    if (end < 0) {
        return { name, value: '', next: index, error: `Attribute ${name} has an unclosed value` };
    }
    return { name, value: decodeXml(text.slice(index + 1, end)), next: end + 1, error: null };
}

function readName(text: string, start: number): string | null {
    const match = /^[A-Za-z_][A-Za-z0-9_.-]*/.exec(text.slice(start));
    return match ? match[0] : null;
}

function skipSpace(text: string, start: number): number {
    let index = start;
    while (index < text.length && /\s/.test(text[index])) {
        index += 1;
    }
    return index;
}

export function stripBom(source: string): string {
    return source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
}

export function decodeXml(value: string): string {
    return value.replace(/&(?:lt|gt|quot|apos|amp);/g, (entity) => {
        switch (entity) {
            case '&lt;':
                return '<';
            case '&gt;':
                return '>';
            case '&quot;':
                return '"';
            case '&apos;':
                return "'";
            case '&amp;':
                return '&';
            default:
                return entity;
        }
    });
}

export function localName(name: string): string {
    const colon = name.lastIndexOf(':');
    return colon >= 0 ? name.slice(colon + 1) : name;
}

export function childElements(element: XmlElement, name: string): readonly XmlElement[] {
    const wanted = name.toLowerCase();
    return element.children.filter((child) => localName(child.name).toLowerCase() === wanted);
}

export function attribute(element: XmlElement, name: string): string | undefined {
    const wanted = name.toLowerCase();
    for (const [key, value] of Object.entries(element.attributes)) {
        if (key.toLowerCase() === wanted) {
            return value;
        }
    }
    return undefined;
}
