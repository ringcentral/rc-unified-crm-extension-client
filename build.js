const { build } = require('esbuild');
const copyStaticFiles = require('esbuild-copy-static-files');
const svgr = require('esbuild-plugin-svgr');
const fs = require('fs');


async function runBuild() {
    // delete dist folder
    fs.rm('./dist', { recursive: true, force: true }, (err) => { });

    build({
        entryPoints: ['src/content.js', 'src/popup.js', 'src/sw.js', 'src/root.jsx'],
        loader: { '.js': 'jsx', '.png': 'dataurl' },
        bundle: true,
        jsx: 'automatic',
        write: true,
        outdir: 'dist',
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
}

runBuild();