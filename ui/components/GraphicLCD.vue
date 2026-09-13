<template>
    <span v-if="label">{{ label }}</span>
    <div ref="display" />
</template>

<script>
import { GraphicLCD } from 'char-lcd'
import { mapState } from 'vuex'

import { applyGraphicMessage, displayOptions } from '../lib/display.js'

export default {
    name: 'GraphicLCD',
    inject: ['$socket'],
    props: {
        id: { type: String, required: true },
        props: { type: Object, default: () => ({}) },
        state: { type: Object, default: () => ({ enabled: false, visible: false }) }
    },
    computed: {
        ...mapState('data', ['messages']),
        label () {
            return this.props.label
        }
    },
    mounted () {
        this.createDisplay()

        this.$socket.on('widget-load:' + this.id, this.onLoad)
        this.$socket.on('msg-input:' + this.id, this.onInput)

        // Notify Node-RED that we're loading a new instance of this widget
        this.$socket.emit('widget-load', this.id)
    },
    unmounted () {
        this.$socket?.off('widget-load:' + this.id, this.onLoad)
        this.$socket?.off('msg-input:' + this.id, this.onInput)
    },
    methods: {
        createDisplay () {
            const at = this.$refs.display
            if (!at) return
            at.replaceChildren()
            this.lcd = new GraphicLCD({
                ...displayOptions(this.props, at),
                width: this.props.lcd_width || 128,
                height: this.props.lcd_height || 64,
                grayscale: !!this.props.grayscale
            })
        },
        onLoad (msg) {
            this.$store.commit('data/bind', { widgetId: this.id, msg })

            // Node-RED stores every msg since the display was last cleared: replay them on a fresh display
            this.createDisplay()
            const msgs = Array.isArray(msg) ? msg : [msg]
            msgs.forEach(this.apply)
        },
        onInput (msg) {
            this.$store.commit('data/bind', { widgetId: this.id, msg })
            this.apply(msg)
        },
        apply (msg) {
            if (msg && this.lcd) applyGraphicMessage(this.lcd, msg, this.props.auto_clear)
        }
    }
}
</script>
