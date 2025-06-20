import * as TJS from "typescript-json-schema";
import path from "node:path";
import fs from "node:fs";
import url from "node:url";

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = url.fileURLToPath(import.meta.url);
const root = path.resolve(__filename, '..', '..');

const program = TJS.getProgramFromFiles([path.resolve(root, 'config.d.ts')]);

const schema = TJS.generateSchema(
    program,
    "JsonConfig.Config",
    {
        required: true,
    }
);

fs.writeFileSync(
    path.resolve(root, 'config.schema.json'),
    JSON.stringify(schema, null, 2)
)
