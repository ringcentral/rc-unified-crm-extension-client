/* eslint-disable no-undef */
const { build } = require('esbuild');
const copyStaticFiles = require('esbuild-copy-static-files');
const svgr = require('esbuild-plugin-svgr');
const fs = require('fs');
const { execSync } = require('child_process');
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

    // Check git branch and update manifest.json name accordingly
    try {
        const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
        const manifestPath = './public/manifest.json';
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        
        if (currentBranch === 'beta') {
            // Add BETA suffix if not already present
            if (!manifest.name.includes(' - BETA')) {
                manifest.name += ' - BETA';
                fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
                console.log(`Updated manifest name for beta branch: ${manifest.name}`);
            }
        } else {
            // Remove BETA suffix if present
            if (manifest.name.includes(' - BETA')) {
                manifest.name = manifest.name.replace(' - BETA', '');
                fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
                console.log(`Updated manifest name for ${currentBranch} branch: ${manifest.name}`);
            }
        }
    } catch (e) { 
        console.log('Error updating manifest for branch:', e.message);
    }

    build({
        entryPoints: ['src/content.js', 'src/popup.js', 'src/sw.js', 'src/root.jsx'],
        loader: { '.js': 'jsx', '.png': 'dataurl' },
        bundle: true,
        jsx: 'automatic',
        write: true,
        outdir: 'dist',
        define: {
            'process.env.MIXPANEL_TOKEN': JSON.stringify(process.env?.MIXPANEL_TOKEN ?? "")
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
}

runBuild();