import { resolve } from 'path'

import vue from '@vitejs/plugin-vue'
import { defineConfig, normalizePath } from 'vite'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// One library per widget, picked with `vite build --mode <name>`.
// The dashboard loads resources/<name>.umd.js and reads the component from window[<name>],
// so each name must match node-red-dashboard-2.widgets[name] in package.json
const WIDGETS = {
    'ui-lcd': 'ui/index.js',
    'ui-glcd': 'ui/glcd.js'
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const LIBRARY_NAME = WIDGETS[mode] ? mode : 'ui-lcd'

    return {
        plugins: [
            vue(),
            cssInjectedByJsPlugin(),
            viteStaticCopy({
                targets: [
                    {
                        // Copy the build output into Node-RED's /resources folder
                        src: normalizePath(resolve(__dirname, `./ui/dist/${LIBRARY_NAME}.umd.js`)),
                        dest: normalizePath(resolve(__dirname, 'resources'))
                    }
                ]
            })
        ],
        build: {
            // Generate a source map in dev mode
            sourcemap: process.env.NODE_ENV === 'development',

            // Configure build as a UMD library
            lib: {
                entry: resolve(__dirname, WIDGETS[LIBRARY_NAME]),
                name: LIBRARY_NAME,
                formats: ['umd'],
                fileName: (format, entryName) => `${LIBRARY_NAME}.${format}.js`
            },

            // This is the target location for the build output
            outDir: './ui/dist',
            // the widgets are built one after another into the same folder
            emptyOutDir: false,

            // Declare dependencies that shouldn't be bundled into the library
            rollupOptions: {
                // Don't rollup the Vue dependency into the build
                external: ['vue', 'vuex'],
                output: {
                    // Provide global variables to use in the UMD build
                    globals: {
                        vue: 'Vue',
                        vuex: 'vuex'
                    }
                }
            }
        }
    }
})
