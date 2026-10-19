import * as fs from 'fs';
import * as path from 'path';

export function readJson<T = any>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

// Write to a temp file and rename over the target so a crash never leaves half a file.
export function writeJsonAtomic(file: string, data: unknown, mode = 0o600): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode });
  try {
    fs.renameSync(tmp, file);
  } catch {
    // On Windows a rename can fail if another process holds the file open; fall back to a direct write.
    fs.writeFileSync(file, JSON.stringify(data, null, 2), { encoding: 'utf8', mode });
    fs.rmSync(tmp, { force: true });
  }
}
