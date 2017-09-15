import {noSpaceTmp} from "../common"
import {languagetoolPlugin, setDecorations, removeDecorations} from "./statePlugin"

export class EditorLT {
    constructor(editor) {
        this.editor = editor
        this.supportedLanguages = []
        this.hasChecked = false
    }

    wavyUnderlineStyle(color) {
        return noSpaceTmp`
        background: url("data:image/svg+xml;utf8,
            <svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' version
                    ='1.1' viewBox='0 0 4 3' height='3' width='4' fill='%23${color}'>
                <path d='M 0.29035517,1.4291044 C -0.92396403,-0.1192701 -0.38579998,-0.3381018
                1 0.58454674,0.90550316 2.2240533,3.0067093 2.3955445,2.3505447 3.5620362,1.241
                324 4.0021271,0.82284017 4.4297825,0.77891784 4.0341445,1.4664179 3.104357,3.08
                21083 1.9261285,3.5148733 0.29035517,1.4291044 Z' />
            </svg>
        ") 50% 100% repeat-x transparent;
        padding-bottom: 0;
        display: inline;`
    }

    init() {
        let styleEl = document.createElement('style')

        styleEl.innerHTML =
        `.language {
            ${this.wavyUnderlineStyle('0000FF')}
        }
        .grammar {
            ${this.wavyUnderlineStyle('84b4a7')}
        }
        .spelling {
            ${this.wavyUnderlineStyle('FF0000')}
        }
        `
        document.head.appendChild(styleEl)

        let toolMenu = this.editor.menu.headerbarModel.content.find(menu => menu.id==='tools')

        toolMenu.content.unshift(
            {
                title: gettext('Finish language check'),
                tooltip: gettext('Remove lines left over in the text from language check.'),
                action: editor => {
                    this.removeMainDecos()
                    this.removeFnDecos()
                    this.hasChecked = false
                },
                disabled: editor => !this.hasChecked
            }
        )

        toolMenu.content.unshift(
            {
                title: gettext('Check language'),
                tooltip: gettext('Check text for grammar and spelling issues.'),
                action: editor => {
                    let language = this.editor.view.state.doc.firstChild.attrs.language
                    this.proofread(this.editor.view, language)
                    this.proofread(this.editor.mod.footnotes.fnEditor.view, language)
                },
                disabled: editor => !this.supportedLanguages.includes(
                    editor.view.state.doc.firstChild.attrs.language
                ) || this.editor.docInfo.access_rights !== 'write'
            }
        )
        this.editor.statePlugins.push(
            [languagetoolPlugin, () => ({editor: this.editor, editorLt: this})]
        )
        this.editor.mod.footnotes.fnEditor.fnStatePlugins.push(
            [languagetoolPlugin, () => ({editor: this.editor, editorLt: this})]
        )


        this.getSupportedLanguages()
    }

    getSupportedLanguages() {
        fetch('/proxy/languagetool/languages', {
            method: "POST",
            credentials: "same-origin",
        }).then(response => response.json()).then(json => {
            this.supportedLanguages = json.map(entry => entry.longCode)
        })
    }

    proofread(view, language) {
        let text = this.getText(view.state.doc)
        let state = view.state
        fetch('/proxy/languagetool/check', {
            method: "POST",
            credentials: "same-origin",
            body: new URLSearchParams(Object.entries({
                text,
                language
            }))
        }).then(response => response.json()).then(json => {
            if(view.state===state) {
                // No changes have been made while spell checking took place.
                let matches = this.filterMatches(view, json.matches)
                this.markMatches(view, matches)
                this.hasChecked = true
            } else {
                // something has changed, run spellchecker again.
                this.proofread(view, language)
            }
        })
    }

    getText(node) {
        let start = '', end = ''
        if (node.type.name==='text') {
            return node.text
        } else if (node.isBlock) {
            let text = ''
            let childCount = node.childCount, i
            for (i = 0; i < childCount; i++) {
                text += this.getText(node.child(i))
            }
            if (node.type.name==='doc') {
                return text
            } else {
                return `\n${text}\n`
            }
        } else {
            return ' '.repeat(node.nodeSize)
        }
    }

    filterMatches(view, matches) {
        // remove matches that touch non-text nodes
        return matches.filter(match =>
            view.state.doc.textBetween(
                match.offset, match.offset + match.length
            ).length === match.length
        )
    }

    markMatches(view, matches) {
        if(!matches.length) {
            return
        }
        let tr = setDecorations(view.state, matches)
        if (tr) {
            view.dispatch(tr)
        }
    }

    removeFnDecos() {
        this.removeDecos(this.editor.mod.footnotes.fnEditor.view)
    }

    removeMainDecos() {
        this.removeDecos(this.editor.view)
    }

    removeDecos(view) {
        let tr = removeDecorations(view.state)
        if (tr) {
            view.dispatch(tr)
        }
        this.hasChecked = false
    }

}
