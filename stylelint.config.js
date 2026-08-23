const path = require("path")
const fs = require("fs")
const {execSync} = require("child_process")

function getFidusWriterPath() {
    try {
        let fwPath = ""
        try {
            fwPath = execSync(
                "python -c \"import fiduswriter; print(next(filter(lambda path: '/site-packages/' in path, fiduswriter.__path__), ''))\""
            )
                .toString()
                .trim()
        } catch {
            fwPath = ""
        }
        if (fwPath) {
            return fwPath
        }
        // Fallback: the backend is checked out as a sibling
        // (fiduswriter-server-backend/fiduswriter).
        const sibling = path.resolve(
            __dirname,
            "..",
            "fiduswriter-server-backend",
            "fiduswriter"
        )
        if (fs.existsSync(sibling) && fs.statSync(sibling).isDirectory()) {
            return sibling
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

const fidusWriterPath = getFidusWriterPath()

// Only validate custom property usage against CSS files that actually
// exist. In CI the plugin pre-commit job installs fiduswriter as a pip
// package whose static-libs/ has not been generated (that happens during
// npm setup), so both candidate files may be missing there.
const cssImportFrom = [
    path.join(fidusWriterPath, "static-libs/css/fwtoolkit/colors.css"),
    path.join(fidusWriterPath, "static-libs/css/colors.css")
].filter(cssPath => fs.existsSync(cssPath))

const rules = {
    "color-hex-length": "long",
    "max-nesting-depth": 2
}

if (cssImportFrom.length > 0) {
    rules["csstools/value-no-unknown-custom-properties"] = [
        true,
        {
            importFrom: cssImportFrom
        }
    ]
}

rules["selector-class-pattern"] = [
    "^(([a-z][a-z0-9]*)(-[a-z0-9]+)*)|(ProseMirror(-[a-z0-9]+)*)$",
    {
        message:
            "Selector should use lowercase and separate words with hyphens (selector-class-pattern)"
    }
]

module.exports = {
    extends: "stylelint-config-standard",
    plugins: ["stylelint-value-no-unknown-custom-properties"],
    rules
}
