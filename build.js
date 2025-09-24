/* eslint-disable no-undef */
const { build } = require('esbuild');
const copyStaticFiles = require('esbuild-copy-static-files');
const svgr = require('esbuild-plugin-svgr');
const fs = require('fs');
require('dotenv').config();


async function runBuild() {

    // delete embeddable index
    fs.rm('./dist', { recursive: true, force: true }, (err) => { });
    // delete dist folder
    fs.rm('./public/embeddable/index.html', { recursive: true, force: true }, (err) => { });

    try {
        // find styled-components issue and fix it
        let dependencyFile = fs.readFileSync('./node_modules/styled-components/dist/styled-components.browser.esm.js', 'utf8');
        dependencyFile = dependencyFile.replaceAll('process.env.', 'process.env?.')
        fs.writeFileSync('./node_modules/styled-components/dist/styled-components.browser.esm.js', dependencyFile);
    } catch (e) { console.log(e) }

    build({
        entryPoints: ['src/content.js', 'src/popup.js', 'src/sw.js', 'src/root.jsx'],
        loader: { '.js': 'jsx', '.png': 'dataurl' },
        bundle: true,
        jsx: 'automatic',
        write: true,
        outdir: 'dist',
        define: {
            'process.env.MIXPANEL_TOKEN': JSON.stringify(process.env?.MIXPANEL_TOKEN ?? ""),
            'process.env.RC_CLIENT_ID': JSON.stringify(process.env?.RC_CLIENT_ID ?? "")
        },
        plugins: [
            copyStaticFiles({
                src: './public',
                dest: './dist',
                dereference: true,
                recursive: true,
            }),
            svgr()
        ]
    })

    // print out build datetime in local
    console.log(`Build datetime: ${new Date().toLocaleString()}`);
}

runBuild();