import fs from 'fs';
import path from 'path';
import url from 'url';
const __filename = url.fileURLToPath(import.meta.url);
export const packageJSON = JSON.parse(fs.readFileSync(path.join(path.dirname(__filename), '..', 'package.json'), 'utf8'));
