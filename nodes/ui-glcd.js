const { DisplayHistory } = require('./lib/history.js')

module.exports = function (RED) {
    function UIGraphicLCDNode (config) {
        RED.nodes.createNode(this, config)
        const node = this

        // Get the dashboard group
        const group = RED.nodes.getNode(config.group)
        if (!group) {
            node.error('No group configured')
            return
        }
        const base = group.getBase()

        const history = new DisplayHistory(RED, 'graphic', config, base.stores.data.get(node.id))

        // Server-side event handlers
        const evts = {
            onAction: true,
            beforeSend (msg) {
                const updates = msg.ui_update
                if (updates && typeof updates.label !== 'undefined') {
                    base.stores.state.set(base, node, msg, 'label', updates.label)
                }
                return msg
            },
            onInput (msg) {
                // keep what is needed to redraw the display for dashboards opened later
                base.stores.data.save(base, node, history.record(msg))
            },
            onSocket: {
                connect (socket) {
                    // Send the configuration values to the client-side widget
                    socket.emit('widget-config:' + node.id, config)
                }
            }
        }

        // Register node with Dashboard UI
        group.register(node, config, evts)
    }

    RED.nodes.registerType('ui-glcd', UIGraphicLCDNode)
}
