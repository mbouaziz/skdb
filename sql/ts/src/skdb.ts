import { runUrl, loadEnv, isNode } from "#std/sk_types.js";
import { createOnThisThread } from "./skdb_create.js";
import type { Wrk } from "#std/sk_types.js";
import type { SKDB, SKDBSync, SKDBShared } from "./skdb_types.js";
import { SKDBWorker } from "./skdb_wdatabase.js";
export { SKDBTable as SKDBTable } from "./skdb_util.js";
export type { SKDB, RemoteSKDB } from "./skdb_types.js";
export type { Creds, MuxedSocket } from "./skdb_orchestration.js";
export type { Environment } from "#std/sk_types.js";
import { getWasmUrl } from "./skdb_wasm_locator.js";

// sknpm searches for the modules line verbatim
// @ts-ignore
// prettier-ignore
var modules = [ /*--MODULES--*/];
var extensions = new Map();
/*--EXTENSIONS--*/

export async function createSkdb(
  options: {
    dbName?: string;
    asWorker?: boolean;
    getWasmSource?: () => Promise<Uint8Array>;
    disableWarnings?: boolean;
  } = {},
): Promise<SKDB> {
  const asWorker =
    options.asWorker != undefined ? options.asWorker : !options.getWasmSource;
  const disableWarnings = options.disableWarnings ?? false;
  if (!asWorker) {
    // @ts-ignore
    return createOnThisThread(
      disableWarnings,
      modules,
      extensions,
      options.dbName,
      options.getWasmSource,
    );
  } else {
    if (options.getWasmSource) {
      throw new Error("getWasmSource is not compatible with worker");
    }
    return createWorker(disableWarnings, options.dbName);
  }
}

async function createSkdbSync(
  options: {
    dbName?: string;
    getWasmSource?: () => Promise<Uint8Array>;
  } = {},
): Promise<SKDBSync> {
  let data = await runUrl(
    getWasmUrl,
    // @ts-ignore
    modules,
    extensions,
    "SKDB_factory",
    options.getWasmSource,
  );
  return (data.environment.shared.get("SKDB") as SKDBShared).createSync(
    options.dbName,
  );
}

async function createWorker(disableWarnings: boolean, dbName?: string) {
  let env = await loadEnv(extensions);
  env.disableWarnings = disableWarnings;
  let worker: Wrk;
  if (isNode()) {
    let path = import.meta.url.replace("/skdb.mjs", "/skdb_nodeworker.mjs");
    //@ts-ignore
    path = "./" + path.substring(process.cwd().length + 8);
    worker = env.createWorker(path, { type: "module" });
  } else {
    // important that this line looks exactly like this for bundlers to discover the file
    const wrapped = new Worker(new URL("./skdb_worker.mjs", import.meta.url), {
      type: "module",
    });
    worker = env.createWorkerWrapper(wrapped);
  }
  let skdb = new SKDBWorker(worker);
  await skdb.create(dbName);
  return skdb;
}
