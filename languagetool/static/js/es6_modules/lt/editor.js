import {languagetoolPlugin, setDecorations, removeDecorations} from "./statePlugin"

export class EditorLT {
    constructor(editor) {
        this.editor = editor
        this.supportedLanguages = []
        this.hasChecked = false
    }

    init() {
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
                this.markMatches(view, json.matches)
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
