import {dialogTemplate} from "./templates"
import {removeDecorationsBetween} from "./statePlugin"

export class DialogLT {
    constructor(editor, view, match) {
        this.editor = editor
        this.view = view
        this.match = match
    }

    init() {
        let buttons = [{
            text: gettext('Cancel'),
            click: () => {
                this.dialog.dialog('close')
            },
            class: 'fw-button fw-orange'
        }]
        let dialogDOM = dialogTemplate({
            header: this.match.shortMessage,
            message: this.match.message,
            replacements: this.match.replacements
        })
        this.dialog = jQuery(dialogDOM)
        this.dialog.dialog({
            width: 320,
            height: 540,
            buttons,
            create: () => this.dialogCreate(),
            close: () => {
                this.dialog.dialog('destroy').remove()
            }
        })
    }

    dialogCreate() {
        let that = this
        jQuery(this.dialog).on('click', '.replacement', function() {
            let id = parseInt(jQuery(this).data('id'))

            let replacement = that.match.replacements[id]
            if (replacement) {
                let removeDecosTr = removeDecorationsBetween(
                    that.view.state,
                    that.view.state.selection.from,
                    that.view.state.selection.to
                )
                that.view.dispatch(removeDecosTr)

                let transaction = that.view.state.tr.replaceSelectionWith(
                    that.view.state.schema.text(replacement.value),
                    true
                )
                that.view.dispatch(transaction)
            }
            console.log(replacement)
            that.dialog.dialog('close')
            that.view.focus()
        })
    }
}
