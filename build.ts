const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runBuild() {
    const { build } = require('esbuild');
    const copyStaticFiles = require('esbuild-copy-static-files');
    const svgr = require('esbuild-plugin-svgr');
    const { sassPlugin } = require('esbuild-sass-plugin');

    // delete embeddable index
    fs.rm('./dist', { recursive: true, force: true }, (err) => { });
    // delete dist folder
    fs.rm('./public/embeddable/index.html', { recursive: true, force: true }, (err) => { });

    try {
        // find styled-components issue and fix it
        let dependencyFile = fs.readFileSync('./node_modules/styled-components/dist/styled-components.browser.esm.js', 'utf8');
        dependencyFile = dependencyFile.replaceAll('process.env.', 'process.env?.');
        fs.writeFileSync('./node_modules/styled-components/dist/styled-components.browser.esm.js', dependencyFile);
    } catch (e) { console.log(e) }

    build({
        entryPoints: ['src/content.ts', 'src/popup.ts', 'src/sw.ts', 'src/root.tsx'],
        loader: { '.js': 'jsx', '.ts': 'ts', '.tsx': 'tsx', '.png': 'dataurl' },
        bundle: true,
        jsx: 'automatic',
        write: true,
        outdir: 'dist',
        define: {
            'process.env.MIXPANEL_TOKEN': JSON.stringify(process.env?.MIXPANEL_TOKEN ?? ""),
            'process.env.RC_CLIENT_ID': JSON.stringify(process.env?.RC_CLIENT_ID ?? "")
        },
        plugins: [
            sassPlugin({
                loadPaths: [path.join(__dirname, 'src/lib')],
                silenceDeprecations: ['import'],
            }),
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

if (require.main === module) {
    runBuild();
}

module.exports = {
    runBuild,
};
