/**
 * Turns Node-RED messages into char-lcd display calls, for both the ui-lcd and ui-glcd widgets.
 *
 * nodes/lib/history.js mirrors the rules below (what draws, what clears, which settings
 * persist) to redraw the display for dashboards opened later: keep the two in sync.
 */

const SETTINGS = ['backlight', 'contrast', 'bright', 'dim', 'colors']
const SETTING_COMMANDS = [...SETTINGS, 'font']

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

// a character code, or a string whose first character is used
function toCode (code) {
    return typeof code === 'string' ? code.charCodeAt(0) : Number(code)
}

function textOf (params) {
    return String(params.text ?? params.payload ?? '')
}

// msg.text wins over msg.payload
function msgText (msg) {
    if (isPrintable(msg.text)) return String(msg.text)
    return isPrintable(msg.payload) ? String(msg.payload) : undefined
}

// msg.payload may hold an array of commands, or a single command
function payloadCommands (msg) {
    if (Array.isArray(msg.payload)) return msg.payload
    return msg.payload && typeof msg.payload === 'object' && msg.payload.cmd ? [msg.payload] : []
}

function hasDrawCommand (list) {
    return toList(list).some(cmd => cmd && cmd.cmd && !SETTING_COMMANDS.includes(cmd.cmd))
}

function drawBitmap (lcd, p) {
    let data = p.data || []
    let w = p.w
    let h = p.h
    if (Array.isArray(data[0])) {
        // rows of values instead of one flat array
        h = h ?? data.length
        w = w ?? Math.max(...data.map(row => row.length))
        data = data.flatMap(row => Array.from({ length: w }, (_, i) => row[i]))
    }
    lcd.bitmap(p.x || 0, p.y || 0, w, h, data)
}

// every command has its parameter names, in the order of the char-lcd method arguments
const COMMON_COMMANDS = {
    clear: { params: [], run: lcd => lcd.clear() },
    font: { params: ['code', 'data'], run: (lcd, p) => lcd.font(toCode(p.code ?? p.n), p.data || []) },
    backlight: {
        params: ['on'],
        run: (lcd, p) => lcd.backlight(p.on === 'toggle' ? !lcd.backlight() : p.on === undefined || toBool(p.on))
    },
    contrast: { params: ['value'], run: (lcd, p) => lcd.contrast(p.value) },
    bright: { params: ['value'], run: (lcd, p) => lcd.bright(p.value) },
    dim: { params: ['value'], run: (lcd, p) => lcd.dim(p.value) },
    colors: { params: ['colors'], run: (lcd, p) => lcd.colors(p.colors || { off: p.off, on: p.on, block: p.block }) }
}

export const CHAR_COMMANDS = {
    ...COMMON_COMMANDS,
    text: { params: ['row', 'col', 'text'], run: (lcd, p) => lcd.text(p.row || 0, p.col || 0, textOf(p)) },
    char: {
        params: ['row', 'col', 'code'],
        run: (lcd, p) => lcd.char(p.row || 0, p.col || 0, String.fromCharCode(toCode(p.code)))
    },
    set: { params: ['row', 'col', 'data'], run: (lcd, p) => lcd.set(p.row || 0, p.col || 0, p.data || p.char || []) }
}

export const GRAPHIC_COMMANDS = {
    ...COMMON_COMMANDS,
    pixel: { params: ['x', 'y', 'v'], run: (lcd, p) => lcd.pixel(p.x || 0, p.y || 0, p.v) },
    fill: { params: ['v'], run: (lcd, p) => lcd.fill(p.v) },
    line: {
        params: ['x0', 'y0', 'x1', 'y1', 'v'],
        run: (lcd, p) => lcd.line(p.x0 || 0, p.y0 || 0, p.x1 || 0, p.y1 || 0, p.v)
    },
    rect: { params: ['x', 'y', 'w', 'h', 'v'], run: (lcd, p) => lcd.rect(p.x || 0, p.y || 0, p.w, p.h, p.v) },
    fillRect: { params: ['x', 'y', 'w', 'h', 'v'], run: (lcd, p) => lcd.fillRect(p.x || 0, p.y || 0, p.w, p.h, p.v) },
    circle: { params: ['x', 'y', 'r', 'v'], run: (lcd, p) => lcd.circle(p.x || 0, p.y || 0, p.r, p.v) },
    fillCircle: { params: ['x', 'y', 'r', 'v'], run: (lcd, p) => lcd.fillCircle(p.x || 0, p.y || 0, p.r, p.v) },
    text: {
        params: ['x', 'y', 'text', 'v', 'bg'],
        run: (lcd, p) => lcd.text(p.x || 0, p.y || 0, textOf(p), p.v, p.bg)
    },
    bitmap: { params: ['x', 'y', 'w', 'h', 'data'], run: drawBitmap }
}

function run (lcd, commands, list) {
    toList(list).forEach(cmd => {
        const def = cmd && commands[cmd.cmd]
        if (!def) {
            console.warn('LCD: unknown command', cmd)
            return
        }
        const params = Array.isArray(cmd.args) ? Object.fromEntries(def.params.map((name, i) => [name, cmd.args[i]])) : cmd
        def.run(lcd, params)
    })
}

// msg.backlight, msg.contrast, msg.bright, msg.dim, msg.colors and msg.fonts
function applySettings (lcd, commands, msg) {
    SETTINGS.forEach(key => {
        if (msg[key] !== undefined && msg[key] !== null) run(lcd, commands, { cmd: key, args: [msg[key]] })
    })
    toList(msg.fonts).forEach(font => run(lcd, commands, { ...font, cmd: 'font' }))
}

export function hasCharDrawing (msg) {
    return toList(msg.cusChars).length > 0 ||
        toList(msg.chars).length > 0 ||
        toList(msg.texts).length > 0 ||
        msgText(msg) !== undefined ||
        hasDrawCommand(payloadCommands(msg)) ||
        hasDrawCommand(msg.commands)
}

export function hasGraphicDrawing (msg) {
    return msgText(msg) !== undefined || hasDrawCommand(payloadCommands(msg)) || hasDrawCommand(msg.commands)
}

// order: settings, fonts, clear, shorthand drawing, msg.payload commands, msg.commands
export function applyCharMessage (lcd, msg, autoClear) {
    applySettings(lcd, CHAR_COMMANDS, msg)
    if (msg.clear || (autoClear && hasCharDrawing(msg))) lcd.clear()

    toList(msg.cusChars).forEach(item => run(lcd, CHAR_COMMANDS, { ...item, cmd: 'set' }))
    toList(msg.chars).forEach(item => run(lcd, CHAR_COMMANDS, { ...item, cmd: 'char' }))
    const texts = toList(msg.texts)
    if (texts.length) {
        texts.forEach(item => run(lcd, CHAR_COMMANDS, { ...item, cmd: 'text' }))
    } else if (msgText(msg) !== undefined) {
        lcd.text(msg.row || 0, msg.col || 0, msgText(msg))
    }
    run(lcd, CHAR_COMMANDS, payloadCommands(msg))
    run(lcd, CHAR_COMMANDS, msg.commands)
}

export function applyGraphicMessage (lcd, msg, autoClear) {
    applySettings(lcd, GRAPHIC_COMMANDS, msg)
    if (msg.clear || (autoClear && hasGraphicDrawing(msg))) lcd.clear()

    if (msgText(msg) !== undefined) lcd.text(msg.x || 0, msg.y || 0, msgText(msg))
    run(lcd, GRAPHIC_COMMANDS, payloadCommands(msg))
    run(lcd, GRAPHIC_COMMANDS, msg.commands)
}

// constructor options shared by both displays, from the node config
export function displayOptions (props, at) {
    const options = {
        at,
        rom: props.rom || 'eu',
        pix: props.pixel_size || 3,
        brk: props.space_size ?? 1,
        off: props.backlight_color || '#ccdd22',
        on: props.pixel_color || '#474d0b',
        transitionDuration: `${props.transitionDuration || 0}ms`,
        backlight: props.backlight ?? true,
        bright: props.bright ?? 1,
        dim: props.dim ?? 0.4,
        contrast: props.contrast ?? 0.5
    }
    if (props.use_block_color && props.block_color) options.block = props.block_color
    return options
}
