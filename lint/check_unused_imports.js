#!/usr/bin/env node

/**
 * Simple script to detect unused imports in JavaScript files.
 * Uses acorn to parse the AST and check if imported symbols are used.
 */

const fs = require("fs")
const acorn = require("acorn")

// Get list of files from command line arguments
const files = process.argv.slice(2)

if (files.length === 0) {
    console.error(
        "Usage: node check-unused-imports.js <file1.js> [file2.js ...]"
    )
    process.exit(1)
}

let hasUnusedImports = false

for (const filePath of files) {
    if (!filePath.endsWith(".js")) {
        continue
    }

    const code = fs.readFileSync(filePath, "utf-8")

    try {
        const ast = acorn.parse(code, {
            ecmaVersion: 2020,
            sourceType: "module",
            locations: true
        })

        // Collect imports
        const imports = new Map() // symbol -> { localName, importNode }
        const usage = new Set() // names that are used

        for (const node of ast.body) {
            if (node.type === "ImportDeclaration") {
                for (const specifier of node.specifiers) {
                    if (specifier.type === "ImportSpecifier") {
                        imports.set(specifier.local.name, {
                            imported: specifier.imported.name,
                            source: node.source.value,
                            loc: specifier.local.loc
                        })
                    } else if (specifier.type === "ImportDefaultSpecifier") {
                        imports.set(specifier.local.name, {
                            imported: "default",
                            source: node.source.value,
                            loc: specifier.local.loc
                        })
                    } else if (specifier.type === "ImportNamespaceSpecifier") {
                        imports.set(specifier.local.name, {
                            imported: "*",
                            source: node.source.value,
                            loc: specifier.local.loc
                        })
                    }
                }
            }
        }

        // Walk the AST to find identifier usage
        function walk(node) {
            if (!node || typeof node !== "object") {
                return
            }

            // Skip import declarations themselves
            if (node.type === "ImportDeclaration") {
                return
            }

            // Check for identifier usage
            if (node.type === "Identifier") {
                usage.add(node.name)
            }

            // Recursively walk child nodes
            for (const key of Object.keys(node)) {
                if (key === "parent" || key === "loc" || key === "range") {
                    continue
                }
                const child = node[key]
                if (Array.isArray(child)) {
                    child.forEach(walk)
                } else if (child && typeof child === "object") {
                    walk(child)
                }
            }
        }

        // Walk the entire AST
        walk(ast)

        // Check for unused imports
        for (const [localName, importInfo] of imports) {
            if (!usage.has(localName)) {
                console.error(
                    `${filePath}:${importInfo.loc.start.line}:${importInfo.loc.start.column + 1}: ` +
                        `Unused import '${localName}' from '${importInfo.source}'`
                )
                hasUnusedImports = true
            }
        }
    } catch (error) {
        console.error(`Error parsing ${filePath}: ${error.message}`)
    }
}

if (hasUnusedImports) {
    process.exit(1)
}
