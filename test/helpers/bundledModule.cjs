const Module = require('module');
const path = require('path');
const { build } = require('esbuild');

async function loadBundledModule(entryPoint, options = {}) {
  const repoRoot = path.resolve(__dirname, '../..');
  const absEntryPoint = path.resolve(repoRoot, entryPoint);
  const stubs = options.stubs || {};
  const stubKeys = new Set(Object.keys(stubs));
  const previousStubs = globalThis.__APP_CONNECT_TEST_STUBS__;
  globalThis.__APP_CONNECT_TEST_STUBS__ = stubs;

  try {
    const result = await build({
      entryPoints: [absEntryPoint],
      bundle: true,
      write: false,
      platform: 'node',
      format: 'cjs',
      loader: {
        '.js': 'jsx',
        '.jsx': 'jsx',
        '.json': 'json',
        '.png': 'dataurl',
        '.svg': 'text',
        '.scss': 'text',
      },
      plugins: [
        {
          name: 'app-connect-test-stubs',
          setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => {
              if (stubKeys.has(args.path)) {
                return { path: args.path, namespace: 'app-connect-test-stub' };
              }
              return null;
            });

            build.onLoad({ filter: /.*/, namespace: 'app-connect-test-stub' }, (args) => ({
              loader: 'js',
              contents: `module.exports = globalThis.__APP_CONNECT_TEST_STUBS__[${JSON.stringify(args.path)}];`,
            }));
          },
        },
      ],
    });

    const compiled = result.outputFiles[0].text;
    const testModule = new Module(absEntryPoint, module);
    testModule.filename = `${absEntryPoint}.test-bundle.cjs`;
    testModule.paths = Module._nodeModulePaths(path.dirname(absEntryPoint));
    testModule._compile(compiled, testModule.filename);
    return testModule.exports;
  } finally {
    globalThis.__APP_CONNECT_TEST_STUBS__ = previousStubs;
  }
}

module.exports = {
  loadBundledModule,
};