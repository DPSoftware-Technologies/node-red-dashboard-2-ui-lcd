/**
 * Remembers the messages sent to a display, so dashboards opened later can redraw it.
 *
 * Keeps every msg since the display was last fully cleared, and folds the settings
 * (backlight, contrast, bright, dim, colors, fonts) of the older msgs into a snapshot.
 * Mirrors the rules of ui/lib/display.js: keep the two in sync.
 */

const SETTINGS = ['backlight', 'contrast', 'bright', 'dim', 'colors']
const PARAMS = {
    backlight: ['on'],
    contrast: ['value'],
    bright: ['value'],
    dim: ['value'],
    colors: ['colors'],
    font: ['code', 'data']
}

// past this many msgs the oldest ones are dropped, keeping only their settings
const MAX_HISTORY = 1000

function isPrintable (value) {
    return (typeof value === 'string' && value !== '') || typeof value === 'number' || typeof value === 'boolean'
}

function toList (value) {
    if (Array.isArray(value)) return value
    return value && typeof value === 'object' ? [value] : []
}

function toBool (value) {
    if (typeof value === 'string') {
        return !['false', 'off', '0', 'no', ''].includes(value.trim().toLowerCase())
    }
    return !!value
}

function toCode (code) {
    return typeof code === 'string' ? code.charCodeAt(0) : Number(code)
}

function hasText (msg) {
    return isPrintable(msg.text) || isPrintable(msg.payload)
}

// commands in msg.payload (an array, or a single command) then msg.commands
function allCommands (msg) {
    let payload = []
    if (Array.isArray(msg.payload)) payload = msg.payload
    else if (msg.payload && typeof msg.payload === 'object' && msg.payload.cmd) payload = [msg.payload]
    return [...payload, ...toList(msg.commands)]
}

function hasDrawCommand (msg) {
    return allCommands(msg).some(cmd => cmd && cmd.cmd && !(cmd.cmd in PARAMS))
}

const KINDS = {
    char: {
        keys: ['clear', ...SETTINGS, 'fonts', 'cusChars', 'chars', 'texts', 'text', 'payload', 'row', 'col', 'commands'],
        clearCommands: ['clear'],
        hasDrawing: msg => toList(msg.cusChars).length > 0 ||
            toList(msg.chars).length > 0 ||
            toList(msg.texts).length > 0 ||
            hasText(msg) ||
            hasDrawCommand(msg)
    },
    graphic: {
        keys: ['clear', ...SETTINGS, 'fonts', 'text', 'payload', 'x', 'y', 'commands'],
        // fill sets every pixel, so it wipes the older msgs just like clear
        clearCommands: ['clear', 'fill'],
        hasDrawing: msg => hasText(msg) || hasDrawCommand(msg)
    }
}

class DisplayHistory {
    /**
     * @param {*} RED - the Node-RED runtime
     * @param {'char'|'graphic'} kind - ui-lcd or ui-glcd
     * @param {*} config - the node config
     * @param {*} stored - what the dashboard datastore holds for the node, e.g. after a redeploy
     */
    constructor (RED, kind, config, stored) {
        this.RED = RED
        this.kind = KINDS[kind]
        this.autoClear = !!config.auto_clear
        this.backlight = config.backlight !== false
        this.settings = {}
        this.fonts = new Map()
        this.entries = []
        toList(stored).forEach(msg => {
            if (msg && msg.snapshot) this.fold(msg)
            else if (msg) this.entries.push(msg)
        })
    }

    // add a msg, and return the list to store for the node
    record (msg) {
        const entry = {}
        this.kind.keys.forEach(key => {
            if (msg[key] !== undefined) entry[key] = msg[key]
        })
        if (Object.keys(entry).length === 0) return this.stored()

        if (this.clears(entry)) {
            this.entries.forEach(old => this.fold(old))
            this.entries = []
        }
        this.entries.push(this.RED.util.cloneMessage(entry))
        if (this.entries.length > MAX_HISTORY) this.fold(this.entries.shift())
        return this.stored()
    }

    // true if the msg wipes everything drawn by the msgs before it
    clears (msg) {
        if (msg.clear || (this.autoClear && this.kind.hasDrawing(msg))) return true
        return allCommands(msg).some(cmd => cmd && this.kind.clearCommands.includes(cmd.cmd))
    }

    // keep the settings of a msg, in the same order as the widget applies them
    fold (msg) {
        SETTINGS.forEach(key => {
            if (msg[key] !== undefined && msg[key] !== null) this.setting({ cmd: key, args: [msg[key]] })
        })
        toList(msg.fonts).forEach(font => this.setting({ ...font, cmd: 'font' }))
        allCommands(msg).forEach(cmd => this.setting(cmd))
    }

    setting (cmd) {
        if (!cmd || !(cmd.cmd in PARAMS)) return
        const p = Array.isArray(cmd.args) ? Object.fromEntries(PARAMS[cmd.cmd].map((name, i) => [name, cmd.args[i]])) : cmd
        switch (cmd.cmd) {
        case 'backlight': {
            const current = this.settings.backlight ?? this.backlight
            this.settings.backlight = p.on === 'toggle' ? !current : p.on === undefined || toBool(p.on)
            break
        }
        case 'colors': {
            const colors = p.colors || { off: p.off, on: p.on, block: p.block }
            this.settings.colors = { ...this.settings.colors }
            for (const key of ['off', 'on', 'block']) {
                if (colors[key] !== undefined) this.settings.colors[key] = colors[key]
            }
            break
        }
        case 'font': {
            const code = toCode(p.code ?? p.n)
            if (!Number.isNaN(code)) this.fonts.set(code, p.data || [])
            break
        }
        default:
            // contrast, bright, dim
            if (p.value !== undefined) this.settings[cmd.cmd] = p.value
        }
    }

    stored () {
        const snapshot = { snapshot: true, ...this.settings }
        if (this.fonts.size) snapshot.fonts = [...this.fonts].map(([code, data]) => ({ code, data }))
        return Object.keys(snapshot).length > 1 ? [snapshot, ...this.entries] : [...this.entries]
    }
}

module.exports = { DisplayHistory }
