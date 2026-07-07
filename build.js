/* eslint-disable no-undef */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

function getManifestNameForBranch({ name, currentBranch, isBranchedFromBeta }) {
    const betaSuffix = ' - BETA';
    if (currentBranch === 'beta' || isBranchedFromBeta) {
        return name.includes(betaSuffix) ? name : `${name}${betaSuffix}`;
    }
    return name.includes(betaSuffix) ? name.replace(betaSuffix, '') : name;
}

function updateManifestNameForBranch({ manifestPath, currentBranch, isBranchedFromBeta }) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const currentName = manifest.name;
    const nextName = getManifestNameForBranch({
        name: currentName,
        currentBranch,
        isBranchedFromBeta,
    });
    if (nextName !== currentName) {
        manifest.name = nextName;
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        if (nextName.includes(' - BETA')) {
            console.log(`Updated manifest name for beta branch: ${manifest.name}`);
        } else {
            console.log(`Updated manifest name for ${currentBranch} branch: ${manifest.name}`);
        }
    }
    return manifest;
}

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

    // Check git branch and update manifest.json name accordingly
    try {
        const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
        const manifestPath = './public/manifest.json';
        
        // Check if current branch is branched from 'beta'
        let isBranchedFromBeta = false;
        try {
            execSync('git merge-base --is-ancestor beta HEAD', { encoding: 'utf8' });
            isBranchedFromBeta = true;
        } catch {
            // beta is not an ancestor of current branch
        }

        updateManifestNameForBranch({ manifestPath, currentBranch, isBranchedFromBeta });
    } catch (e) { 
        console.log('Error updating manifest for branch:', e.message);
    }

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
    getManifestNameForBranch,
    updateManifestNameForBranch,
    runBuild,
};
