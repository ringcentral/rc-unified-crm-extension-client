import { build } from 'esbuild';
import copyStaticFiles from 'esbuild-copy-static-files';
import svgr from 'esbuild-plugin-svgr';
import fs from 'fs';


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