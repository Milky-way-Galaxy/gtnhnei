import { Repository } from '../repository';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
let lpSolver = require('javascript-lp-solver');
// Register the actual solver as window.solver for tests
const globalAny = global;
globalAny.window = {
    solver: lpSolver
};
export async function setupRepository() {
    const dataPath = path.join(process.cwd(), 'data', 'data.bin');
    const compressedData = await fs.readFile(dataPath);
    const buffer = await new Promise((resolve, reject) => {
        zlib.gunzip(compressedData, (err, decompressed) => {
            if (err)
                reject(err);
            else {
                const arrayBuffer = new ArrayBuffer(decompressed.length);
                const view = new Uint8Array(arrayBuffer);
                decompressed.copy(view);
                resolve(arrayBuffer);
            }
        });
    });
    Repository.load(buffer);
}
//# sourceMappingURL=setup.js.map