import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
export const packageJSON = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(__filename), '..', 'package.json'),
    'utf8'
  )
);
