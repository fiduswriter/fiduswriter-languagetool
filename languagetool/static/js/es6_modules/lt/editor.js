import {noSpaceTmp} from "../common"
import {languagetoolPlugin, setDecorations, removeDecorations} from "./statePlugin"

export class EditorLT {
    constructor(editor) {
        this.editor = editor
        this.supportedLanguages = []
        this.hasChecked = false
        this.sources = {
            main: { // main editor
                view: this.editor.view,
                posMap: [], // a map between doc positions in prosemirror and positions in LT
                badPos: [] // LT positions that have no PM equivalents
            },
            footnotes: { // footnote editor
                view: this.editor.mod.footnotes.fnEditor.view,
                posMap: [],
                badPos: []
            }
        }
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
                title: gettext('Finish spell/grammar check'),
                type: 'action',
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
                title: gettext('Spell/grammar check'),
                type: 'action',
                tooltip: gettext('Check text for grammar and spelling issues.'),
                action: editor => {
                    let language = this.editor.view.state.doc.firstChild.attrs.language
                    this.proofread(this.sources.main, language)
                    this.proofread(this.sources.footnotes, language)
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

    proofread(source, language) {
        source.posMap = []
        source.badPos = []
        let text = this.getText({
            node: source.view.state.doc,
            pos: 0,
            posMap: source.posMap,
            badPos: source.badPos
        }).text
        let state = source.view.state
        fetch('/proxy/languagetool/check', {
            method: "POST",
            credentials: "same-origin",
            body: new URLSearchParams(Object.entries({
                text,
                language
            }))
        }).then(response => response.json()).then(json => {
            if(source.view.state===state) {
                // No changes have been made while spell checking took place.
                let matches = json.matches
                matches = this.ltFilterMatches(source.badPos, matches)
                matches = this.transMatches(source.posMap, matches)
                matches = this.pmFilterMatches(source.view, matches)
                this.markMatches(source.view, matches)
                this.hasChecked = true
            } else {
                // something has changed, run spellchecker again.
                this.proofread(source, language)
            }
        })
    }

    getText({node, pos, posMap, badPos}) {
        let text = ''
        if (node.type.name==='text') {
            pos += node.text.length
            text = node.text
        } else if (node.isBlock) {
            if (node.type.name !== 'doc') {
                pos++
                text += '\n'
            }
            let childCount = node.childCount, i
            for (i = 0; i < childCount; i++) {
                let childText = this.getText({node: node.child(i), pos, posMap, badPos})
                pos = childText.pos
                text += childText.text
            }
            if (node.type.name !== 'doc') {
                pos++
                text += '\n'
            }
        } else if (node.type.name==='citation' && node.attrs.format==='textcite') {
            // Citation is used as part of sentence - like "Peter (1999) said that..."
            // We replace it with the name "John" to get the correct errors and mark the
            // 4 letters of "John" in badPos.
            text += 'John'
            badPos.push([pos, pos + 4])
            posMap.push([pos, node.nodeSize - 4])
        } else {
            posMap.push([pos, node.nodeSize])
        }
        return {text, pos}
    }

    ltFilterMatches(badPos, matches) {
        // remove matches touching positions that cannot be translated to PM.
        return matches.filter(match =>
            !badPos.find(bad =>
                match.offset <= bad[0] && match.offset + match.length > bad[0] ||
                match.offset <= bad[1] && match.offset + match.length > bad[1]
            )
        )
    }

    transPos(ltPos, posMap) {
        // translate positions from languagetool to prosemirror
        let offset = 0
        posMap.find(map => {
            if (map[0] > ltPos) {
                return true
            } else {
                offset += map[1]
                return false
            }
        })
        return ltPos + offset
    }

    transMatches(posMap, matches) {
        // translate the 'offset' and 'length' values from lt to 'from' and 'to' in PM.
        matches.forEach(match => {
            match.from = this.transPos(match.offset, posMap)
            match.to = this.transPos(match.offset + match.length, posMap)
        })
        return matches
    }

    pmFilterMatches(view, matches) {
        // remove matches that touch non-text nodes in PM
        return matches.filter(match =>
            view.state.doc.textBetween(
                match.from, match.to
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
        this.removeDecos(this.sources.footnotes.view)
    }

    removeMainDecos() {
        this.removeDecos(this.sources.main.view)
    }

    removeDecos(view) {
        let tr = removeDecorations(view.state)
        if (tr) {
            view.dispatch(tr)
        }
        this.hasChecked = false
    }

}
