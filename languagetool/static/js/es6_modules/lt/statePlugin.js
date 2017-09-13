import {Plugin, PluginKey, TextSelection} from "prosemirror-state"
import {Decoration, DecorationSet} from "prosemirror-view"
import {DialogLT} from "./dialog"

const key = new PluginKey('languagetool')

export let setDecorations = function(state, matches) {
    let decos = DecorationSet.empty

    matches.forEach((match, index) => {
        let color = 'green'
        if (match.rule.category.id==='TYPOS') {
            color = 'red'
        } else if (match.rule.category.id==='GRAMMAR') {
            color = 'blue'
        }
        let deco = Decoration.inline(match.offset, match.offset + match.length, {
            style: `text-decoration: underline dotted ${color};`
        }, {id: index})
        decos = decos.add(state.doc, [deco])
    })

    let transaction = state.tr.setMeta(key, {decos, matches})
    return transaction
}

export let removeDecorations = function(state) {
    let {
        decos
    } = key.getState(state)

    if (decos.find().length === 0) {
        return
    }
    decos = DecorationSet.empty
    let matches = []

    let transaction = state.tr.setMeta(key, {decos, matches})
    return transaction
}

export let removeDecorationsBetween = function(state, from, to) {
    let {
        decos, matches
    } = key.getState(state)

    decos = decos.remove(decos.find(from, to))
    let transaction = state.tr.setMeta(key, {decos, matches})
    return transaction

}

export let languagetoolPlugin = function(options) {
    return new Plugin({
        key,
        state: {
            init() {
                return {
                    decos: DecorationSet.empty,
                    matches: []
                }
            },
            apply(tr, prev, oldState, state) {

                if (
                    oldState.doc.firstChild &&
                    oldState.doc.firstChild.attrs.language &&
                    oldState.doc.firstChild.attrs.language !== state.doc.firstChild.attrs.language
                ) {
                    // language has changed, remove all decorations
                    // also remove from footnotes
                    options.editorLt.removeFnDecos()
                    return {
                        decos: DecorationSet.empty,
                        matches: []
                    }
                }

                let meta = tr.getMeta(key)
                if (meta) {
                    // There has been an update, return values from meta instead
                    // of previous values
                    return meta
                }
                let {
                    decos, matches
                } = this.getState(oldState)

                decos = decos.map(tr.mapping, tr.doc)

                return {
                    decos, matches
                }
            }
        },
        props: {
            decorations(state) {
				let {
					decos
				} = this.getState(state)
				return decos
			},
            attributes: {
                spellcheck: false
            },
            handleContextMenu(view, pos, event) {
				let {
					decos, matches
				} = this.getState(view.state)
				let deco = decos.find(pos, pos)[0]
				if (!deco) {
                    return false
                }
                let match = matches[deco.spec.id]
                let transaction = view.state.tr.setSelection(
                    TextSelection.create(view.state.doc, deco.from, deco.to)
                )
                view.dispatch(transaction)

                let dialog = new DialogLT(options.editor, view, match)
                dialog.init()
                return true
            }
        }
    })
}
