const path = require("path")
const {execSync} = require("child_process")

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

const fidusWriterPath = getFidusWriterPath()

module.exports = {
    extends: "stylelint-config-standard",
    plugins: ["stylelint-value-no-unknown-custom-properties"],
    rules: {
        "color-hex-length": "long",
        "max-nesting-depth": 2,
        "csstools/value-no-unknown-custom-properties": [
            true,
            {
                importFrom: [
                    path.join(fidusWriterPath, "base/static/css/colors.css")
                ]
            }
        ],
        "selector-class-pattern": [
            "^(([a-z][a-z0-9]*)(-[a-z0-9]+)*)|(ProseMirror(-[a-z0-9]+)*)$",
            {
                message:
                    "Selector should use lowercase and separate words with hyphens (selector-class-pattern)"
            }
        ]
    }
}
