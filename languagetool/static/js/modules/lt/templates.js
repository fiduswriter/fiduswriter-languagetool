import {escapeText} from "../common"

export const dialogTemplate = ({message, replacements}) =>
    `<table class="fw-dialog-table">
        <tr><td>
            <p>${escapeText(message)}</p>
        </td</tr>
    ${
        replacements.length ?
        `<tr><td>
            <p>${gettext('Replace with')}:</p>
        </td</tr>` :
        ''
    }
    ${
        replacements.map((replacement, index)=>
            `<tr><td><button class="replacement fw-button fw-white fw-large" style="width: 296px;" data-id="${index}">
                ${replacement.value}
            </button></td></tr>`
        ).join('')
    }
    </table>`
