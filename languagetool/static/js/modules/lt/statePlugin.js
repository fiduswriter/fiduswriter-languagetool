import {Plugin, PluginKey, TextSelection} from "prosemirror-state"
import {Decoration, DecorationSet} from "prosemirror-view"
import {DialogLT} from "./dialog"

const key = new PluginKey('languagetool')

export let setDecorations = function(state, matches) {
    let decos = DecorationSet.empty

    matches.forEach((match, index) => {
        let className = 'language'
        if (match.rule.category.id==='TYPOS') {
            className = 'spelling'
        } else if (match.rule.category.id==='GRAMMAR') {
            className = 'grammar'
        }
        let deco = Decoration.inline(match.from, match.to, {
            class: className
        }, {id: index})
        decos = decos.add(state.doc, [deco])
    })

    return state.tr.setMeta(key, {decos, matches})
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

    return state.tr.setMeta(key, {decos, matches})
}

export let removeDecorationsBetween = function(state, from, to) {
    let {
        decos, matches
    } = key.getState(state)

    decos = decos.remove(decos.find(from, to))
    return state.tr.setMeta(key, {decos, matches})
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
            handleDOMEvents: {
                contextmenu(view, event) {
                    let pos = view.posAtCoords({left: event.clientX, top: event.clientY})
                    if (!pos) {
                        return
                    }
                    pos = pos.pos
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
                    event.preventDefault()
                    return true
                }
            }
        }
    })
}
