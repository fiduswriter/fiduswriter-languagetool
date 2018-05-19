import {dialogTemplate} from "./templates"
import {removeDecorationsBetween} from "./state_plugin"
import {Dialog, escapeText, findTarget} from "../common"

export class DialogLT {
    constructor(editor, view, match) {
        this.editor = editor
        this.view = view
        this.match = match
    }

    init() {
        let replacements = this.match.replacements
        this.dialog = new Dialog({
            width: 350,
            height: Math.min(49 * replacements.length + 60, 660),
            title: escapeText(this.match.shortMessage),
            body: dialogTemplate({
                message: this.match.message,
                replacements
            }),
            buttons: [{type: 'close'}]
        })
        this.dialog.open()
        this.bind()
    }

    bind() {
        this.dialog.dialogEl.addEventListener('click', event => {
            let el = {}
            switch (true) {
                case findTarget(event, '.replacement', el):
                    let id = parseInt(el.target.dataset.id)
                    this.applyReplacement(id)
                    break
                default:
                    break
            }
        })
    }

    applyReplacement(id) {
        let replacement = this.match.replacements[id]
        if (
            replacement &&
            this.view.state.selection.from !== this.view.state.selection.to
        ) {
            let removeDecosTr = removeDecorationsBetween(
                this.view.state,
                this.view.state.selection.from,
                this.view.state.selection.to
            )
            this.view.dispatch(removeDecosTr)

            let transaction = this.view.state.tr.replaceSelectionWith(
                this.view.state.schema.text(replacement.value),
                true
            )
            this.view.dispatch(transaction)
        }
        this.dialog.close()
        this.view.focus()
    }
}
