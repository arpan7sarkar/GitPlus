/**
 * Symbol Extractor
 * Walks a tree-sitter AST and pulls out semantic symbols (functions, classes,
 * methods, interfaces, enums, types) instead of relying on line-count windows.
 * Node-type names are per-language (verified empirically against each grammar,
 * not guessed) since every tree-sitter grammar names its nodes differently.
 *
 * A class/impl-block is emitted as ONE symbol if it fits under the size cap the
 * caller (chunker.ts) enforces; the caller decides whether to keep the whole
 * container or fall back to the individual `methods` listed here instead —
 * this module just reports both possibilities, it doesn't decide between them.
 */

import type { TSNode } from "./treeSitter.js";

export type SymbolType = "function" | "class" | "method" | "interface" | "enum" | "type";

export interface ExtractedSymbol {
  name: string;
  symbolType: SymbolType;
  startLine: number; // 1-indexed, inclusive
  endLine: number; // 1-indexed, inclusive
  parentSymbolPath: string | null; // e.g. the class/impl name, for methods
  containerId: string | null; // links a method to its container's containerId
}

function nodeName(node: TSNode, fallback = "<anonymous>"): string {
  return node.childForFieldName("name")?.text || fallback;
}

function span(node: TSNode): { startLine: number; endLine: number } {
  return { startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1 };
}

function containerKey(symbolType: SymbolType, name: string, startLine: number): string {
  return `${symbolType}:${name}:${startLine}`;
}

// ─── TypeScript / TSX / JavaScript ──────────────────────────────────────────────

const TS_CLASS_TYPES = new Set(["class_declaration"]);
const TS_METHOD_TYPES = new Set(["method_definition"]);
const TS_STANDALONE_TYPES: Record<string, SymbolType> = {
  function_declaration: "function",
  generator_function_declaration: "function",
  interface_declaration: "interface",
  enum_declaration: "enum",
  type_alias_declaration: "type",
};

function extractTsLike(root: TSNode): ExtractedSymbol[] {
  const out: ExtractedSymbol[] = [];

  function visit(node: TSNode) {
    // Unwrap pass-through wrapper nodes without extracting anything from them.
    if (node.type === "program" || node.type === "export_statement" || node.type === "statement_block") {
      for (const child of node.namedChildren) visit(child);
      return;
    }

    if (TS_STANDALONE_TYPES[node.type]) {
      const { startLine, endLine } = span(node);
      out.push({
        name: nodeName(node),
        symbolType: TS_STANDALONE_TYPES[node.type],
        startLine,
        endLine,
        parentSymbolPath: null,
        containerId: null,
      });
      return; // don't recurse into a standalone symbol's body
    }

    if (TS_CLASS_TYPES.has(node.type)) {
      const { startLine, endLine } = span(node);
      const name = nodeName(node);
      const id = containerKey("class", name, startLine);
      out.push({ name, symbolType: "class", startLine, endLine, parentSymbolPath: null, containerId: id });

      const body = node.childForFieldName("body");
      for (const member of body?.namedChildren || []) {
        if (TS_METHOD_TYPES.has(member.type)) {
          const m = span(member);
          out.push({
            name: nodeName(member, "constructor"),
            symbolType: "method",
            startLine: m.startLine,
            endLine: m.endLine,
            parentSymbolPath: name,
            containerId: id,
          });
        }
      }
      return; // methods already handled explicitly, don't double-recurse
    }

    // const foo = (...) => {...} / function (...) {...}
    if (node.type === "lexical_declaration" || node.type === "variable_declaration") {
      for (const declarator of node.namedChildren) {
        if (declarator.type !== "variable_declarator") continue;
        const value = declarator.childForFieldName("value");
        if (value && (value.type === "arrow_function" || value.type === "function_expression" || value.type === "function")) {
          const { startLine, endLine } = span(node);
          out.push({
            name: declarator.childForFieldName("name")?.text || "<anonymous>",
            symbolType: "function",
            startLine,
            endLine,
            parentSymbolPath: null,
            containerId: null,
          });
        }
      }
      return;
    }

    for (const child of node.namedChildren) visit(child);
  }

  visit(root);
  return out;
}

// ─── Python ──────────────────────────────────────────────────────────────────

function extractPython(root: TSNode): ExtractedSymbol[] {
  const out: ExtractedSymbol[] = [];

  function visit(node: TSNode) {
    if (node.type === "module" || node.type === "block") {
      for (const child of node.namedChildren) visit(child);
      return;
    }

    if (node.type === "class_definition") {
      const { startLine, endLine } = span(node);
      const name = nodeName(node);
      const id = containerKey("class", name, startLine);
      out.push({ name, symbolType: "class", startLine, endLine, parentSymbolPath: null, containerId: id });

      const body = node.childForFieldName("body");
      for (const member of body?.namedChildren || []) {
        if (member.type === "function_definition") {
          const m = span(member);
          out.push({
            name: nodeName(member),
            symbolType: "method",
            startLine: m.startLine,
            endLine: m.endLine,
            parentSymbolPath: name,
            containerId: id,
          });
        }
      }
      return;
    }

    if (node.type === "function_definition") {
      const { startLine, endLine } = span(node);
      out.push({ name: nodeName(node), symbolType: "function", startLine, endLine, parentSymbolPath: null, containerId: null });
      return;
    }

    for (const child of node.namedChildren) visit(child);
  }

  visit(root);
  return out;
}

// ─── Go ──────────────────────────────────────────────────────────────────────

function extractGo(root: TSNode): ExtractedSymbol[] {
  const out: ExtractedSymbol[] = [];

  for (const node of root.namedChildren) {
    if (node.type === "function_declaration") {
      const { startLine, endLine } = span(node);
      out.push({ name: nodeName(node), symbolType: "function", startLine, endLine, parentSymbolPath: null, containerId: null });
      continue;
    }

    if (node.type === "method_declaration") {
      const { startLine, endLine } = span(node);
      // receiver is a parameter_list wrapping one parameter_declaration, e.g. `(b *Baz)`
      const receiverParam = node.childForFieldName("receiver")?.namedChildren[0];
      const receiverType = receiverParam?.childForFieldName("type");
      const parentName = (receiverType?.type === "pointer_type" ? receiverType.namedChild(0)?.text : receiverType?.text) || null;
      out.push({
        name: nodeName(node),
        symbolType: "method",
        startLine,
        endLine,
        parentSymbolPath: parentName,
        containerId: parentName ? containerKey("class", parentName, -1) : null,
      });
      continue;
    }

    if (node.type === "type_declaration") {
      for (const spec of node.namedChildren) {
        if (spec.type !== "type_spec") continue;
        const typeNode = spec.childForFieldName("type");
        const symbolType: SymbolType = typeNode?.type === "interface_type" ? "interface" : typeNode?.type === "struct_type" ? "class" : "type";
        const { startLine, endLine } = span(node);
        const name = spec.childForFieldName("name")?.text || "<anonymous>";
        out.push({
          name,
          symbolType,
          startLine,
          endLine,
          parentSymbolPath: null,
          containerId: symbolType === "class" ? containerKey("class", name, -1) : null,
        });
      }
    }
  }

  return out;
}

// ─── Rust ────────────────────────────────────────────────────────────────────

function extractRust(root: TSNode): ExtractedSymbol[] {
  const out: ExtractedSymbol[] = [];

  for (const node of root.namedChildren) {
    if (node.type === "function_item") {
      const { startLine, endLine } = span(node);
      out.push({ name: nodeName(node), symbolType: "function", startLine, endLine, parentSymbolPath: null, containerId: null });
      continue;
    }

    if (node.type === "struct_item") {
      const { startLine, endLine } = span(node);
      const name = nodeName(node);
      out.push({ name, symbolType: "type", startLine, endLine, parentSymbolPath: null, containerId: null });
      continue;
    }

    if (node.type === "trait_item") {
      const { startLine, endLine } = span(node);
      out.push({ name: nodeName(node), symbolType: "interface", startLine, endLine, parentSymbolPath: null, containerId: null });
      continue;
    }

    if (node.type === "enum_item") {
      const { startLine, endLine } = span(node);
      out.push({ name: nodeName(node), symbolType: "enum", startLine, endLine, parentSymbolPath: null, containerId: null });
      continue;
    }

    if (node.type === "impl_item") {
      const { startLine, endLine } = span(node);
      const typeName = node.childForFieldName("type")?.text || "<anonymous>";
      const id = containerKey("class", typeName, startLine);
      // The whole `impl Type { ... }` block, in case it's small enough to keep as one chunk.
      out.push({ name: typeName, symbolType: "class", startLine, endLine, parentSymbolPath: null, containerId: id });

      const body = node.childForFieldName("body");
      for (const member of body?.namedChildren || []) {
        if (member.type === "function_item") {
          const m = span(member);
          out.push({
            name: nodeName(member),
            symbolType: "method",
            startLine: m.startLine,
            endLine: m.endLine,
            parentSymbolPath: typeName,
            containerId: id,
          });
        }
      }
    }
  }

  return out;
}

// ─── Java ────────────────────────────────────────────────────────────────────

const JAVA_CLASS_TYPES = new Set(["class_declaration"]);
const JAVA_METHOD_TYPES = new Set(["method_declaration", "constructor_declaration"]);
const JAVA_STANDALONE_TYPES: Record<string, SymbolType> = {
  interface_declaration: "interface",
  enum_declaration: "enum",
};

function extractJava(root: TSNode): ExtractedSymbol[] {
  const out: ExtractedSymbol[] = [];

  function visit(node: TSNode) {
    if (node.type === "program") {
      for (const child of node.namedChildren) visit(child);
      return;
    }

    if (JAVA_STANDALONE_TYPES[node.type]) {
      const { startLine, endLine } = span(node);
      out.push({ name: nodeName(node), symbolType: JAVA_STANDALONE_TYPES[node.type], startLine, endLine, parentSymbolPath: null, containerId: null });
      return;
    }

    if (JAVA_CLASS_TYPES.has(node.type)) {
      const { startLine, endLine } = span(node);
      const name = nodeName(node);
      const id = containerKey("class", name, startLine);
      out.push({ name, symbolType: "class", startLine, endLine, parentSymbolPath: null, containerId: id });

      const body = node.childForFieldName("body");
      for (const member of body?.namedChildren || []) {
        if (JAVA_METHOD_TYPES.has(member.type)) {
          const m = span(member);
          out.push({
            name: nodeName(member),
            symbolType: "method",
            startLine: m.startLine,
            endLine: m.endLine,
            parentSymbolPath: name,
            containerId: id,
          });
        }
      }
      return;
    }

    for (const child of node.namedChildren) visit(child);
  }

  visit(root);
  return out;
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

export function extractSymbols(language: string, root: TSNode): ExtractedSymbol[] {
  switch (language) {
    case "typescript":
    case "tsx":
    case "javascript":
      return extractTsLike(root);
    case "python":
      return extractPython(root);
    case "go":
      return extractGo(root);
    case "rust":
      return extractRust(root);
    case "java":
      return extractJava(root);
    default:
      return [];
  }
}
