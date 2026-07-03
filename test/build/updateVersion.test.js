import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import updateVersionModule from '../../updateVersion.js';

const {
  FILES_TO_UPDATE,
  isValidVersion,
  updateVersionInFile,
  main,
} = updateVersionModule;

describe('updateVersion', () => {
  let consoleErrorSpy;
  let consoleLogSpy;
  let exitSpy;
  let originalArgv;
  let originalCwd;
  let tempDir;

  beforeEach(() => {
    originalArgv = process.argv;
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-connect-version-'));
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.chdir(originalCwd);
    exitSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('validates semver releases, prereleases, and build metadata', () => {
    expect(isValidVersion('1.2.3')).toBe(true);
    expect(isValidVersion('2.0.0-beta.1')).toBe(true);
    expect(isValidVersion('3.4.5+build.7')).toBe(true);
    expect(isValidVersion('3.4.5-rc.1+build.7')).toBe(true);

    expect(isValidVersion('1.2')).toBe(false);
    expect(isValidVersion('v1.2.3')).toBe(false);
    expect(isValidVersion('1.2.3.4')).toBe(false);
    expect(isValidVersion('1.2.x')).toBe(false);
  });

  it('targets every release artifact that carries the extension version', () => {
    expect(FILES_TO_UPDATE.map((file) => file.path)).toEqual([
      'package.json',
      'package-lock.json',
      'public/manifest.json',
      'src/manifest.json',
    ]);
  });

  it('updates a JSON version field and preserves two-space JSON formatting', () => {
    const filePath = path.join(tempDir, 'manifest.json');
    fs.writeFileSync(filePath, JSON.stringify({ name: 'client', version: '1.0.0' }, null, 2));

    expect(updateVersionInFile(filePath, '1.2.3', 'Test manifest')).toBe(true);

    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toEqual({
      name: 'client',
      version: '1.2.3',
    });
    expect(fs.readFileSync(filePath, 'utf8')).toBe('{\n  "name": "client",\n  "version": "1.2.3"\n}\n');
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('returns false when the target JSON file does not exist', () => {
    const filePath = path.join(tempDir, 'missing.json');

    expect(updateVersionInFile(filePath, '1.2.3', 'Missing file')).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('File not found'));
  });

  it('returns false when the target file is not valid JSON', () => {
    const filePath = path.join(tempDir, 'bad.json');
    fs.writeFileSync(filePath, '{not json');

    expect(updateVersionInFile(filePath, '1.2.3', 'Bad JSON')).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error updating Bad JSON'),
      expect.any(String),
    );
  });

  it('exits with usage help when no version argument is provided', () => {
    process.argv = ['node', 'updateVersion.js'];

    expect(() => main()).toThrow('exit:1');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Version argument is required'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: node updateVersion.js'));
  });

  it('exits before writing files when the version argument is invalid', () => {
    process.argv = ['node', 'updateVersion.js', 'v2.0'];

    expect(() => main()).toThrow('exit:1');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid version format'));
  });

  it('updates all configured files from the CLI main flow', () => {
    process.argv = ['node', 'updateVersion.js', '2.3.4'];
    process.chdir(tempDir);
    for (const file of FILES_TO_UPDATE) {
      fs.mkdirSync(path.dirname(path.join(tempDir, file.path)), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, file.path),
        JSON.stringify({ name: file.description, version: '1.0.0' }, null, 2),
      );
    }

    main();

    for (const file of FILES_TO_UPDATE) {
      expect(JSON.parse(fs.readFileSync(path.join(tempDir, file.path), 'utf8')).version).toBe('2.3.4');
    }
    expect(exitSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('All files updated successfully'));
  });

  it('exits with failure after trying every configured file when any update fails', () => {
    process.argv = ['node', 'updateVersion.js', '2.3.5'];
    process.chdir(tempDir);
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ version: '1.0.0' }, null, 2));

    expect(() => main()).toThrow('exit:1');

    expect(JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8')).version).toBe('2.3.5');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('File not found'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Some files failed to update'));
  });
});
