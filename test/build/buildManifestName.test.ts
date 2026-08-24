import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type BuildModule = {
  getManifestNameForBranch(options: {
    name: string;
    currentBranch: string;
    isBranchedFromBeta: boolean;
  }): string;
  updateManifestNameForBranch(options: {
    manifestPath: string;
    currentBranch: string;
    isBranchedFromBeta: boolean;
  }): { name: string };
};

const buildModule = require('../../build.ts') as BuildModule;

const { getManifestNameForBranch, updateManifestNameForBranch } = buildModule;

describe('build manifest name helpers', () => {
  let tempDir;
  let consoleLogSpy;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-build-'));
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('adds BETA suffix for beta branches and beta descendants without duplicating it', () => {
    expect(getManifestNameForBranch({
      name: 'App Connect',
      currentBranch: 'beta',
      isBranchedFromBeta: false,
    })).toBe('App Connect - Beta');

    expect(getManifestNameForBranch({
      name: 'App Connect',
      currentBranch: 'feature/from-beta',
      isBranchedFromBeta: true,
    })).toBe('App Connect - Beta');

    expect(getManifestNameForBranch({
      name: 'App Connect - Beta',
      currentBranch: 'beta',
      isBranchedFromBeta: true,
    })).toBe('App Connect - Beta');
  });

  it('removes BETA suffix for non-beta branches', () => {
    expect(getManifestNameForBranch({
      name: 'App Connect - Beta',
      currentBranch: 'main',
      isBranchedFromBeta: false,
    })).toBe('App Connect');

    expect(getManifestNameForBranch({
      name: 'App Connect',
      currentBranch: 'main',
      isBranchedFromBeta: false,
    })).toBe('App Connect');
  });

  it('updates public manifest name in place for branch flavor changes', () => {
    const manifestPath = path.join(tempDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify({ name: 'App Connect', version: '1.7.35' }, null, 2));

    expect(updateManifestNameForBranch({
      manifestPath,
      currentBranch: 'beta',
      isBranchedFromBeta: false,
    })).toEqual({
      name: 'App Connect - Beta',
      version: '1.7.35',
    });

    expect(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).name).toBe('App Connect - Beta');
    expect(consoleLogSpy).toHaveBeenCalledWith('Updated manifest name for beta branch: App Connect - Beta');

    expect(updateManifestNameForBranch({
      manifestPath,
      currentBranch: 'main',
      isBranchedFromBeta: false,
    })).toEqual({
      name: 'App Connect',
      version: '1.7.35',
    });
    expect(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).name).toBe('App Connect');
    expect(consoleLogSpy).toHaveBeenCalledWith('Updated manifest name for main branch: App Connect');
  });
});
