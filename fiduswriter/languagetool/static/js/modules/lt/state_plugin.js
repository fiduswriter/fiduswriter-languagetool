import {Plugin, PluginKey, TextSelection} from "prosemirror-state"
import {Decoration, DecorationSet} from "prosemirror-view"

import {DialogLT} from "./dialog"

const key = new PluginKey('languagetool')

export const setDecorations = function(state, newMatches) {
    const keyState = key.getState(state),
        matches = keyState.matches
    let decos = keyState.decos

    newMatches.forEach((match, index) => {
        let className = 'language'
        if (match.rule.category.id==='TYPOS') {
            className = 'spelling'
        } else if (match.rule.category.id==='GRAMMAR') {
            className = 'grammar'
        }
        const deco = Decoration.inline(match.from, match.to, {
            class: className
        }, {id: index + matches.length})
        decos = decos.add(state.doc, [deco])
    })

    return state.tr.setMeta(key, {decos, matches: matches.concat(newMatches)})
}

export const removeDecorations = function(state) {
    let {
        decos
    } = key.getState(state)

    if (decos.find().length === 0) {
        return
    }
    decos = DecorationSet.empty

    return state.tr.setMeta(key, {decos, matches: []})
}

export const removeDecorationsBetween = function(state, from, to) {
    const keyState = key.getState(state),
        matches = keyState.matches
    let decos = keyState.decos

    decos = decos.remove(decos.find(from, to))
    return state.tr.setMeta(key, {decos, matches})
}

export const languagetoolPlugin = function(options) {
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

                const meta = tr.getMeta(key)
                if (meta) {
                    // There has been an update, return values from meta instead
                    // of previous values
                    return meta
                }
                const keyState = key.getState(oldState),
                    matches = keyState.matches
                let decos = keyState.decos

                decos = decos.map(tr.mapping, tr.doc)

                return {
                    decos, matches
                }
            }
        },
        props: {
            decorations(state) {
				const {
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
                    const {decos, matches} = this.getState(view.state)
                    const deco = decos.find(pos, pos)[0]
                    if (!deco) {
                        return false
                    }
                    const match = matches[deco.spec.id]
                    const transaction = view.state.tr.setSelection(
                        TextSelection.create(view.state.doc, deco.from, deco.to)
                    )
                    view.dispatch(transaction)

                    const dialog = new DialogLT(options.editor, view, match)
                    dialog.init()
                    event.preventDefault()
                    return true
                }
            }
        }
    })
}
