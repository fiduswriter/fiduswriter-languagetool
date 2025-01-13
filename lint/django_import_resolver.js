const path = require("path")
const fs = require("fs")
const acorn = require("acorn")
const {execSync} = require("child_process")

const EXCEPTIONS = ["../../../mathlive/opf_includes"]

function getFidusWriterPath() {
    try {
        const fwPath = execSync(
            "python -c \"import fiduswriter; print(next(filter(lambda path: '/site-packages/' in path, fiduswriter.__path__), ''))\""
        )
            .toString()
            .trim()
        if (fwPath) {
            return fwPath
        }
        throw new Error("Fidus Writer not found")
    } catch (error) {
        console.error(
            "Failed to find Fidus Writer installation:",
            error.message
        )
        process.exit(1)
    }
}

function isFile(file) {
    let stat
    try {
        stat = fs.statSync(file)
    } catch (e) {
        if (e && (e.code === "ENOENT" || e.code === "ENOTDIR")) {
            return false
        }
        throw e
    }
    return stat.isFile() || stat.isFIFO()
}

function getAppsPaths(rootDir) {
    const appsPaths = []
    const subdirs = fs.readdirSync(rootDir, {withFileTypes: true})
    subdirs.forEach(subdir => {
        if (subdir.isDirectory()) {
            const staticPath = path.join(rootDir, subdir.name, "static")
            if (
                fs.existsSync(staticPath) &&
                fs.lstatSync(staticPath).isDirectory()
            ) {
                appsPaths.push(path.join(rootDir, subdir.name))
            }
        }
    })
    return appsPaths
}

function resolveFilelocation(source, file, appsPaths) {
    const returnValue = {found: false, path: null}
    const fullPath = path.resolve(path.dirname(file), source)

    if (fullPath.includes("/plugins/")) {
        returnValue.found = true
        returnValue.path = null
        return returnValue
    }

    // Check in plugin and fidus writer apps
    appsPaths.find(appPath => {
        const resolvedPath = fullPath.replace(
            /.*\/static\/js\//g,
            `${appPath}/static/js/`
        )
        if (isFile(`${resolvedPath}.js`)) {
            returnValue.path = `${resolvedPath}.js`
            returnValue.found = true
            return true
        }
        if (isFile(`${resolvedPath}/index.js`)) {
            returnValue.path = `${resolvedPath}/index.js`
            returnValue.found = true
            return true
        }

        return false
    })

    return returnValue
}

function checkExports(filePath, importedNames, sourcePath) {
    const content = fs.readFileSync(filePath, "utf-8")
    const ast = acorn.parse(content, {
        sourceType: "module",
        ecmaVersion: "latest"
    })

    const exportedNames = new Set()

    ast.body.forEach(node => {
        if (node.type === "ExportNamedDeclaration") {
            if (node.declaration) {
                if (node.declaration.id) {
                    exportedNames.add(node.declaration.id.name)
                } else if (node.declaration.declarations) {
                    node.declaration.declarations.forEach(decl => {
                        if (decl.id && decl.id.name) {
                            exportedNames.add(decl.id.name)
                        }
                    })
                }
            }
            if (node.specifiers) {
                node.specifiers.forEach(spec => {
                    exportedNames.add(spec.exported.name)
                })
            }
        } else if (node.type === "ExportDefaultDeclaration") {
            exportedNames.add("default")
        }
    })

    importedNames.forEach(name => {
        if (!exportedNames.has(name)) {
            console.error(
                `Unresolved export: ${name} not found in ${filePath}, imported in ${sourcePath}`
            )
            process.exit(1)
        }
    })
}

function checkImports(file, appsPaths) {
    const content = fs.readFileSync(file, "utf-8")
    const importRegex =
        /import\s+(?:(\*\s+as\s+\w+)|(\w+)|(\{[^}]+\}))\s+from\s+['"](.*)['"]/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
        const source = match[4]
        // Skip non-relative imports
        if (!source.startsWith(".") && !source.startsWith("..")) {
            continue
        }
        if (EXCEPTIONS.includes(source)) {
            continue
        }
        const result = resolveFilelocation(source, file, appsPaths)
        if (!result.found) {
            console.error(`Unresolved import: ${source} in file ${file}`)
            process.exit(1)
        }

        const importedNames = []
        if (match[1]) {
            // import * as name
            importedNames.push("*")
        } else if (match[2]) {
            // import name
            importedNames.push("default")
        } else if (match[3]) {
            // import { name1, name2 }
            const names = match[3]
                .replace(/[{}]/g, "")
                .split(",")
                .map(name => name.trim())
            importedNames.push(...names)
        }
        if (!result.path) {
            // Plugin - final path cannot be checked yet.
            return
        }
        checkExports(result.path, importedNames, file)
    }
}

const pluginPath = path.resolve(__dirname, "../fiduswriter")
const pluginAppsPaths = getAppsPaths(pluginPath)

const fidusWriterPath = getFidusWriterPath()
const fidusWriterAppsPaths = getAppsPaths(fidusWriterPath)

const appsPaths = pluginAppsPaths.concat(fidusWriterAppsPaths)

const files = process.argv.slice(2)
files.forEach(file => checkImports(file, appsPaths))
