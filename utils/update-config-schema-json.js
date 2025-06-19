import * as TJS from "typescript-json-schema";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(import.meta.dirname, '..');

const program = TJS.getProgramFromFiles([path.resolve(root, 'config.d.ts')]);

const schema = TJS.generateSchema(
    program,
    "Config",
    {
        required: true,
    }
);

fs.writeFileSync(
    path.resolve(root, 'config.schema.json'),
    JSON.stringify(schema, null, 2)
)
