// prettier-ignore
import type { int, ptr, Links, Utils, ToWasmManager, Environment, Opt, Metadata, ErrorObject } from "#std/sk_types.js";
import type { SKJSON } from "./skjson.js";
import type {
  Accumulator,
  NonEmptyIterator,
  Result,
  AValue,
  LazyCollection,
  TJSON,
} from "../skipruntime_api.js";

import type {
  Handle,
  Handles,
  Context,
  FromWasm,
  CtxMapping,
} from "./skipruntime_types.js";
import type * as Internal from "./skstore_internal_types.js";
import { LSelfImpl, SKStoreFactoryImpl } from "./skipruntime_impl.js";
// prettier-ignore
import type { SKDBShared } from "#skdb/skdb_types.js";

class HandlesImpl implements Handles {
  private nextID: number = 1;
  private objects: any[] = [];
  private freeIDs: int[] = [];
  private env: Environment;

  constructor(env: Environment) {
    this.env = env;
  }

  register<T>(v: T): Handle<T> {
    const freeID = this.freeIDs.pop();
    const id = freeID ?? this.nextID++;
    this.objects[id] = v;
    return id as Handle<T>;
  }

  get<T>(id: Handle<T>): T {
    return this.objects[id] as T;
  }

  apply<R, P extends any[]>(id: Handle<(..._: P) => R>, parameters: P): R {
    const fn = this.get(id);
    return fn.apply(null, parameters);
  }

  delete<T>(id: Handle<T>): T {
    const current = this.get(id);
    this.objects[id] = null;
    this.freeIDs.push(id);
    return current;
  }

  name = (metadata: Metadata) => {
    return (
      "b64_" +
      this.env.base64Encode(JSON.stringify(metadata)).replaceAll("=", "")
    );
  };
}

export class ContextImpl implements Context {
  skjson: SKJSON;
  exports: FromWasm;
  handles: Handles;
  ref: Ref;

  constructor(skjson: SKJSON, exports: FromWasm, handles: Handles, ref: Ref) {
    this.skjson = skjson;
    this.exports = exports;
    this.handles = handles;
    this.ref = ref;
  }

  noref() {
    return new ContextImpl(this.skjson, this.exports, this.handles, new Ref());
  }

  lazy = <K extends TJSON, V extends TJSON>(
    name: string,
    compute: (self: LazyCollection<K, V>, key: K) => Opt<V>,
  ) => {
    const lazyHdl = this.exports.SkipRuntime_lazy(
      this.pointer(),
      this.skjson.exportString(name),
      this.handles.register(compute),
    );
    return this.skjson.importString(lazyHdl);
  };

  asyncLazy = <K extends TJSON, V extends TJSON, P extends TJSON>(
    name: string,
    get: (key: K) => P,
    call: (key: K, params: P) => Promise<V>,
  ) => {
    const lazyHdl = this.exports.SkipRuntime_asyncLazy(
      this.pointer(),
      this.skjson.exportString(name),
      this.handles.register(get),
      this.handles.register(call),
    );
    return this.skjson.importString(lazyHdl);
  };

  multimap = <
    K1 extends TJSON,
    V1 extends TJSON,
    K2 extends TJSON,
    V2 extends TJSON,
  >(
    name: string,
    mappings: CtxMapping<K1, V1, K2, V2>[],
  ) => {
    const skMappings = mappings.map((mapping) => [
      mapping.source.getId(),
      this.handles.register(mapping.mapper),
    ]);
    const resHdlPtr = this.exports.SkipRuntime_multimap(
      this.pointer(),
      this.skjson.exportString(name),
      this.skjson.exportJSON(skMappings),
    );
    return this.skjson.importString(resHdlPtr);
  };

  multimapReduce = <
    K1 extends TJSON,
    V1 extends TJSON,
    K2 extends TJSON,
    V2 extends TJSON,
    V3 extends TJSON,
  >(
    name: string,
    mappings: CtxMapping<K1, V1, K2, V2>[],
    accumulator: Accumulator<V2, V3>,
  ) => {
    const skMappings = mappings.map((mapping) => [
      mapping.source.getId(),
      this.handles.register(mapping.mapper),
    ]);
    const resHdlPtr = this.exports.SkipRuntime_multimapReduce(
      this.pointer(),
      this.skjson.exportString(name),
      this.skjson.exportJSON(skMappings),
      this.handles.register(accumulator),
      this.skjson.exportJSON(accumulator.default),
    );
    return this.skjson.importString(resHdlPtr);
  };

  getFromTable = <K, R>(table: string, key: K, index?: string) => {
    return this.skjson.importJSON(
      this.exports.SkipRuntime_getFromTable(
        this.pointer(),
        this.skjson.exportString(table),
        this.skjson.exportJSON(key),
        this.skjson.exportJSON(index ?? null),
      ),
    ) as R[];
  };

  getArray = <K, V>(eagerHdl: string, key: K) => {
    return this.skjson.importJSON(
      this.exports.SkipRuntime_getArray(
        this.pointer(),
        this.skjson.exportString(eagerHdl),
        this.skjson.exportJSON(key),
      ),
    ) as V[];
  };

  getOne = <K, V>(eagerHdl: string, key: K) => {
    return this.skjson.importJSON(
      this.exports.SkipRuntime_get(
        this.pointer(),
        this.skjson.exportString(eagerHdl),
        this.skjson.exportJSON(key),
      ),
    ) as V;
  };

  maybeGetOne = <K, V>(eagerHdl: string, key: K) => {
    const res = this.exports.SkipRuntime_maybeGet(
      this.pointer(),
      this.skjson.exportString(eagerHdl),
      this.skjson.exportJSON(key),
    );
    return this.skjson.importJSON(res) as Opt<V>;
  };

  getArrayLazy = <K, V>(lazyHdl: string, key: K) => {
    return this.skjson.importJSON(
      this.exports.SkipRuntime_getArrayLazy(
        this.pointer(),
        this.skjson.exportString(lazyHdl),
        this.skjson.exportJSON(key),
      ),
    ) as V[];
  };

  getOneLazy = <K, V>(lazyHdl: string, key: K) => {
    return this.skjson.importJSON(
      this.exports.SkipRuntime_getLazy(
        this.pointer(),
        this.skjson.exportString(lazyHdl),
        this.skjson.exportJSON(key),
      ),
    ) as V;
  };

  maybeGetOneLazy = <K, V>(lazyHdl: string, key: K) => {
    return this.skjson.importJSON(
      this.exports.SkipRuntime_maybeGetLazy(
        this.pointer(),
        this.skjson.exportString(lazyHdl),
        this.skjson.exportJSON(key),
      ),
    ) as Opt<V>;
  };

  getArraySelf = <K, V>(lazyHdl: ptr<Internal.LHandle>, key: K) => {
    return this.skjson.importJSON(
      this.exports.SkipRuntime_getArraySelf(
        this.pointer(),
        lazyHdl,
        this.skjson.exportJSON(key),
      ),
    ) as V[];
  };
  getOneSelf = <K, V>(lazyHdl: ptr<Internal.LHandle>, key: K) => {
    return this.skjson.importJSON(
      this.exports.SkipRuntime_getSelf(
        this.pointer(),
        lazyHdl,
        this.skjson.exportJSON(key),
      ),
    ) as V;
  };
  maybeGetOneSelf = <K, V>(lazyHdl: ptr<Internal.LHandle>, key: K) => {
    return this.skjson.importJSON(
      this.exports.SkipRuntime_maybeGetSelf(
        this.pointer(),
        lazyHdl,
        this.skjson.exportJSON(key),
      ),
    ) as Opt<V>;
  };

  size = (eagerHdl: string) => {
    return this.exports.SkipRuntime_size(
      this.pointer(),
      this.skjson.exportString(eagerHdl),
    );
  };

  mapReduce = <
    K extends TJSON,
    V extends TJSON,
    K2 extends TJSON,
    V2 extends TJSON,
    V3 extends TJSON,
  >(
    eagerHdl: string,
    name: string,
    mapper: (key: K, it: NonEmptyIterator<V>) => Iterable<[K2, V2]>,
    accumulator: Accumulator<V2, V3>,
  ) => {
    const resHdlPtr = this.exports.SkipRuntime_mapReduce(
      this.pointer(),
      this.skjson.exportString(eagerHdl),
      this.skjson.exportString(name),
      this.handles.register(mapper),
      this.handles.register(accumulator),
      this.skjson.exportJSON(accumulator.default),
    );
    return this.skjson.importString(resHdlPtr);
  };

  map = <K extends TJSON, V extends TJSON, K2 extends TJSON, V2 extends TJSON>(
    eagerHdl: string,
    name: string,
    mapper: (key: K, it: NonEmptyIterator<V>) => Iterable<[K2, V2]>,
  ) => {
    const computeFnId = this.handles.register(mapper);
    const resHdlPtr = this.exports.SkipRuntime_map(
      this.pointer(),
      this.skjson.exportString(eagerHdl),
      this.skjson.exportString(name),
      computeFnId,
    );
    return this.skjson.importString(resHdlPtr);
  };

  mapFromSkdb = <R extends TJSON, K extends TJSON, V extends TJSON>(
    table: string,
    name: string,
    mapper: (entry: R, occ: number) => Iterable<[K, V]>,
  ) => {
    const computeFnId = this.handles.register(mapper);
    const eagerHdl = this.exports.SkipRuntime_fromSkdb(
      this.pointer(),
      this.skjson.exportString(table),
      this.skjson.exportString(name),
      computeFnId,
    );
    return this.skjson.importString(eagerHdl);
  };

  mapToSkdb = <R, K, V>(
    eagerHdl: string,
    table: string,
    convert: (key: K, it: NonEmptyIterator<V>) => R,
  ) => {
    const convertId = this.handles.register(convert);
    this.exports.SkipRuntime_toSkdb(
      this.pointer(),
      this.skjson.exportString(eagerHdl),
      this.skjson.exportString(table),
      convertId,
    );
  };

  private pointer = () => {
    return this.ref.get()!;
  };
}

class NonEmptyIteratorImpl<T> implements NonEmptyIterator<T> {
  private skjson: SKJSON;
  private exports: FromWasm;
  private pointer: ptr<Internal.NonEmptyIterator>;

  constructor(
    skjson: SKJSON,
    exports: FromWasm,
    pointer: ptr<Internal.NonEmptyIterator>,
  ) {
    this.skjson = skjson;
    this.exports = exports;
    this.pointer = pointer;
  }

  next(): Opt<T> {
    return this.skjson.importOptJSON(
      this.exports.SkipRuntime_iteratorNext(this.pointer),
    ) as Opt<T>;
  }

  first(): T {
    return this.skjson.importJSON(
      this.exports.SkipRuntime_iteratorFirst(this.pointer),
    ) as T;
  }

  uniqueValue(): Opt<T> {
    return this.skjson.importOptJSON(
      this.exports.SkipRuntime_iteratorUniqueValue(this.pointer),
    ) as Opt<T>;
  }

  toArray: () => T[] = () => {
    return Array.from(this);
  };

  [Symbol.iterator](): Iterator<T> {
    const cloned_iter = new NonEmptyIteratorImpl<T>(
      this.skjson,
      this.exports,
      this.exports.SkipRuntime_cloneIterator(this.pointer),
    );

    return {
      next() {
        const value = cloned_iter.next();
        return { value, done: value == null } as IteratorResult<T>;
      },
    };
  }
}

class WriterImpl<K, T> {
  private skjson: SKJSON;
  private exports: FromWasm;
  private pointer: ptr<Internal.TWriter>;

  constructor(
    skjson: SKJSON,
    exports: FromWasm,
    pointer: ptr<Internal.TWriter>,
  ) {
    this.skjson = skjson;
    this.exports = exports;
    this.pointer = pointer;
  }

  set = (key: K, value: T) => {
    this.exports.SkipRuntime_writerSet(
      this.pointer,
      this.skjson.exportJSON(key),
      this.skjson.exportJSON(value),
    );
  };
  setArray = (key: K, values: T[]) => {
    this.exports.SkipRuntime_writerSetArray(
      this.pointer,
      this.skjson.exportJSON(key),
      this.skjson.exportJSON(values),
    );
  };
}

interface ToWasm {
  SKIP_SKStore_detachHandle<T>(fn: Handle<T>): void;
  // Context
  SKIP_SKStore_applyMapFun<
    K extends TJSON,
    V extends TJSON,
    K2 extends TJSON,
    V2 extends TJSON,
  >(
    fn: Handle<(key: K, it: NonEmptyIterator<V>) => Iterable<[K2, V2]>>,
    context: ptr<Internal.Context>,
    writer: ptr<Internal.TWriter>,
    key: ptr<Internal.CJSON>,
    it: ptr<Internal.NonEmptyIterator>,
  ): void;
  SKIP_SKStore_applyMapTableFun<
    R extends TJSON,
    K extends TJSON,
    V extends TJSON,
  >(
    fn: Handle<(row: R, occ: number) => Iterable<[K, V]>>,
    context: ptr<Internal.Context>,
    writer: ptr<Internal.TWriter>,
    row: ptr<Internal.CJArray>,
    occ: int,
  ): void;
  SKIP_SKStore_applyConvertToRowFun<
    R extends TJSON,
    K extends TJSON,
    V extends TJSON,
  >(
    fn: Handle<(key: K, it: NonEmptyIterator<V>) => R>,
    key: ptr<Internal.CJSON>,
    it: ptr<Internal.NonEmptyIterator>,
  ): ptr<Internal.CJSON>;
  SKIP_SKStore_init(context: ptr<Internal.Context>): void;
  SKIP_SKStore_applyLazyFun<K extends TJSON, V extends TJSON>(
    fn: Handle<(selfHdl: LazyCollection<K, V>, key: K) => Opt<V>>,
    context: ptr<Internal.Context>,
    self: ptr<Internal.LHandle>,
    key: ptr<Internal.CJSON>,
  ): ptr<Internal.CJSON>;
  SKIP_SKStore_applyParamsFun<K extends TJSON, P extends TJSON>(
    fn: Handle<(key: K) => P>,
    context: ptr<Internal.Context>,
    key: ptr<Internal.CJSON>,
  ): ptr<Internal.CJSON>;
  SKIP_SKStore_applyLazyAsyncFun<
    K extends TJSON,
    V extends TJSON,
    P extends TJSON,
    M extends TJSON,
  >(
    fn: Handle<(key: K, params: P) => Promise<AValue<V, M>>>,
    callId: ptr<Internal.String>,
    name: ptr<Internal.String>,
    key: ptr<Internal.CJSON>,
    param: ptr<Internal.CJSON>,
  ): void;

  // Accumulator
  SKIP_SKStore_applyAccumulate<T extends TJSON, V extends TJSON>(
    fn: Handle<Accumulator<T, V>>,
    acc: ptr<Internal.CJSON>,
    value: ptr<Internal.CJSON>,
  ): ptr<Internal.CJSON>;
  SKIP_SKStore_applyDismiss<T extends TJSON, V extends TJSON>(
    fn: Handle<Accumulator<T, V>>,
    acc: ptr<Internal.CJSON>,
    value: ptr<Internal.CJSON>,
  ): Opt<ptr<Internal.CJSON>>;
  // Utils
  SKIP_SKStore_getErrorHdl(exn: ptr<Internal.Exception>): Handle<ErrorObject>;
}

class Ref {
  pointers: ptr<Internal.Context>[] = [];

  push(pointer: ptr<Internal.Context>) {
    this.pointers.push(pointer);
  }

  get(): Opt<ptr<Internal.Context>> {
    if (this.pointers.length == 0) return null;
    return this.pointers[this.pointers.length - 1];
  }

  pop(): void {
    this.pointers.pop();
  }
}

class LinksImpl implements Links {
  env: Environment;
  handles: Handles;
  skjson?: SKJSON;

  detachHandle!: <T>(fn: Handle<T>) => void;
  applyMapFun!: <
    K extends TJSON,
    V extends TJSON,
    K2 extends TJSON,
    V2 extends TJSON,
  >(
    fn: Handle<(key: K, it: NonEmptyIterator<V>) => Iterable<[K2, V2]>>,
    context: ptr<Internal.Context>,
    writer: ptr<Internal.TWriter>,
    key: ptr<Internal.CJSON>,
    it: ptr<Internal.NonEmptyIterator>,
  ) => void;
  applyMapTableFun!: <R extends TJSON, K extends TJSON, V extends TJSON>(
    fn: Handle<(row: R, occ: number) => Iterable<[K, V]>>,
    context: ptr<Internal.Context>,
    writer: ptr<Internal.TWriter>,
    row: ptr<Internal.CJArray>,
    occ: int,
  ) => void;

  applyLazyFun!: <K extends TJSON, V extends TJSON>(
    fn: Handle<(selfHdl: LazyCollection<K, V>, key: K) => Opt<V>>,
    context: ptr<Internal.Context>,
    self: ptr<Internal.LHandle>,
    key: ptr<Internal.CJSON>,
  ) => ptr<Internal.CJSON>;
  applyParamsFun!: <K extends TJSON, P extends TJSON>(
    fn: Handle<(key: K) => P>,
    context: ptr<Internal.Context>,
    key: ptr<Internal.CJSON>,
  ) => ptr<Internal.CJSON>;
  applyLazyAsyncFun!: <
    K extends TJSON,
    V extends TJSON,
    P extends TJSON,
    M extends TJSON,
  >(
    fn: Handle<(key: K, params: P) => Promise<AValue<V, M>>>,
    callId: ptr<Internal.String>,
    name: ptr<Internal.String>,
    key: ptr<Internal.CJSON>,
    param: ptr<Internal.CJSON>,
  ) => void;
  init!: (context: ptr<Internal.Context>) => void;
  applyAccumulate!: <T extends TJSON, V extends TJSON>(
    fn: Handle<Accumulator<T, V>>,
    acc: ptr<Internal.CJSON>,
    value: ptr<Internal.CJSON>,
  ) => ptr<Internal.CJSON>;
  applyDismiss!: <T extends TJSON, V extends TJSON>(
    fn: Handle<Accumulator<T, V>>,
    acc: ptr<Internal.CJSON>,
    value: ptr<Internal.CJSON>,
  ) => Opt<ptr<Internal.CJSON>>;
  getErrorHdl!: (exn: ptr<Internal.Exception>) => Handle<ErrorObject>;
  applyConvertToRowFun!: <R extends TJSON, K extends TJSON, V extends TJSON>(
    fn: Handle<(key: K, it: NonEmptyIterator<V>) => R>,
    key: ptr<Internal.CJSON>,
    it: ptr<Internal.NonEmptyIterator>,
  ) => ptr<Internal.CJSON>;

  private initFn!: () => void;

  constructor(env: Environment) {
    this.env = env;
    this.handles = new HandlesImpl(env);
  }

  complete = (utils: Utils, exports: object) => {
    let notify: (() => void) | null = null;
    const fromWasm = exports as FromWasm;
    const skjson = () => {
      if (this.skjson == undefined) {
        this.skjson = this.env.shared.get("SKJSON")! as SKJSON;
      }
      return this.skjson;
    };
    const ref = new Ref();
    this.applyMapFun = <
      K1 extends TJSON,
      V1 extends TJSON,
      K2 extends TJSON,
      V2 extends TJSON,
    >(
      fn: Handle<(key: K1, it: NonEmptyIterator<V1>) => Iterable<[K2, V2]>>,
      ctx: ptr<Internal.Context>,
      writer: ptr<Internal.TWriter>,
      key: ptr<Internal.CJSON>,
      it: ptr<Internal.NonEmptyIterator>,
    ) => {
      ref.push(ctx);
      const jsu = skjson();
      const w = new WriterImpl(jsu, fromWasm, writer);
      const result = this.handles.apply(fn, [
        jsu.importJSON(key) as K1,
        new NonEmptyIteratorImpl<V1>(jsu, fromWasm, it),
      ]);
      const bindings = new Map<K2, V2[]>();
      for (const datum of result) {
        const k = datum[0];
        const v = datum[1];
        const at_k = bindings.get(k);
        if (at_k !== undefined) {
          at_k.push(v);
        } else {
          bindings.set(k, [v]);
        }
      }
      for (const kv of bindings) {
        w.setArray(kv[0], kv[1]);
      }
      ref.pop();
    };
    this.applyMapTableFun = <R extends TJSON, K extends TJSON, V extends TJSON>(
      fn: Handle<(row: R, occ: number) => Iterable<[K, V]>>,
      ctx: ptr<Internal.Context>,
      writer: ptr<Internal.TWriter>,
      row: ptr<Internal.CJArray>,
      occ: int,
    ) => {
      ref.push(ctx);
      const jsu = skjson();
      const w = new WriterImpl(jsu, fromWasm, writer);
      const result = this.handles.apply(fn, [jsu.importJSON(row) as R, occ]);
      for (const t of result) {
        w.set(t[0], t[1]);
      }
      ref.pop();
    };

    this.applyConvertToRowFun = <
      R extends TJSON,
      K extends TJSON,
      V extends TJSON,
    >(
      fn: Handle<(key: K, it: NonEmptyIterator<V>) => R>,
      key: ptr<Internal.CJSON>,
      it: ptr<Internal.NonEmptyIterator>,
    ) => {
      const jsu = skjson();
      const res = this.handles.apply(fn, [
        jsu.importJSON(key) as K,
        new NonEmptyIteratorImpl<V>(jsu, fromWasm, it),
      ]);
      return jsu.exportJSON(res);
    };

    this.applyLazyAsyncFun = <
      K extends TJSON,
      V extends TJSON,
      P extends TJSON,
      M extends TJSON,
    >(
      fn: Handle<(key: K, params: P) => Promise<AValue<V, M>>>,
      skcall: ptr<Internal.String>,
      skname: ptr<Internal.String>,
      skkey: ptr<Internal.CJSON>,
      skparams: ptr<Internal.CJSON>,
    ) => {
      const jsu = skjson();
      const callId = jsu.importString(skcall);
      const name = jsu.importString(skname);
      const key = jsu.importJSON(skkey, true) as K;
      const params = jsu.importJSON(skparams, true) as P;
      const promise = this.handles.apply(fn, [key, params]);
      const register = (value: Result<TJSON, TJSON>) => {
        if (!notify) {
          const skdbApp = this.env.shared.get("SKDB") as SKDBShared;
          notify = skdbApp.notify;
        }
        setTimeout(() => {
          const result = jsu.runWithGC(() => {
            return Math.trunc(
              fromWasm.SkipRuntime_asyncResult(
                jsu.exportString(callId),
                jsu.exportString(name),
                jsu.exportJSON(key),
                jsu.exportJSON(params),
                jsu.exportJSON(value),
              ),
            );
          });
          if (result < 0) {
            throw this.handles.delete(-result as Handle<unknown>);
          } else if (notify) {
            notify();
          }
        }, 0);
      };
      promise
        .then((value) => {
          if (value.payload !== undefined) {
            register(
              value.metadata !== undefined
                ? {
                    status: "success",
                    payload: value.payload,
                    metadata: value.metadata,
                  }
                : {
                    status: "success",
                    payload: value.payload,
                  },
            );
          } else {
            register(
              value.metadata !== undefined
                ? {
                    status: "unchanged",
                    metadata: value.metadata,
                  }
                : {
                    status: "unchanged",
                  },
            );
          }
        })
        .catch((reason: unknown) => {
          let msg: string;
          if (reason instanceof Error) {
            msg = reason.message;
          } else if (typeof reason == "string") {
            msg = reason;
          } else {
            msg = JSON.stringify(reason);
          }
          register({ status: "failure", error: msg });
        });
    };

    this.applyLazyFun = <K extends TJSON, V extends TJSON>(
      fn: Handle<(selfHdl: LazyCollection<K, V>, key: K) => Opt<V>>,
      ctx: ptr<Internal.Context>,
      hdl: ptr<Internal.LHandle>,
      key: ptr<Internal.CJSON>,
    ) => {
      ref.push(ctx);
      const jsu = skjson();
      const context = new ContextImpl(jsu, fromWasm, this.handles, ref);
      const res = jsu.exportJSON(
        this.handles.apply(fn, [
          new LSelfImpl(context, hdl) as LazyCollection<K, V>,
          jsu.importJSON(key) as K,
        ]),
      );
      ref.pop();
      return res;
    };

    this.applyParamsFun = <K extends TJSON, P extends TJSON>(
      fn: Handle<(key: K) => P>,
      ctx: ptr<Internal.Context>,
      key: ptr<Internal.CJSON>,
    ) => {
      ref.push(ctx);
      const jsu = skjson();
      const res = jsu.exportJSON(
        this.handles.apply(fn, [jsu.importJSON(key) as K]),
      );
      ref.pop();
      return res;
    };
    this.init = (context: ptr<Internal.Context>) => {
      ref.push(context);
      this.initFn();
      ref.pop();
    };
    this.applyAccumulate = <T extends TJSON, V extends TJSON>(
      fn: Handle<Accumulator<T, V>>,
      acc: ptr<Internal.CJSON>,
      value: ptr<Internal.CJSON>,
    ) => {
      const jsu = skjson();
      const accumulator = this.handles.get(fn);
      const result = accumulator.accumulate(
        jsu.importJSON(acc) as Opt<V>,
        jsu.importJSON(value) as T,
      );
      return jsu.exportJSON(result);
    };
    this.applyDismiss = <T extends TJSON, V extends TJSON>(
      fn: Handle<Accumulator<T, V>>,
      acc: ptr<Internal.CJSON>,
      value: ptr<Internal.CJSON>,
    ) => {
      const jsu = skjson();
      const accumulator = this.handles.get(fn);
      const result = accumulator.dismiss(
        jsu.importJSON(acc) as V,
        jsu.importJSON(value) as T,
      );
      return result != null ? jsu.exportJSON(result) : null;
    };
    this.detachHandle = <T>(idx: Handle<T>) => {
      this.handles.delete(idx);
    };
    this.getErrorHdl = (exn: ptr<Internal.Exception>) => {
      return this.handles.register(utils.getErrorObject(exn));
    };
    const create = (init: () => void) => {
      // Register the init function to have  a named init function
      this.initFn = init;
      // Get a run uuid to build to allow function mapping reload in case of persistence
      const uuid = this.env.crypto().randomUUID();
      const jsu = skjson();
      const result = utils.runWithGc(() =>
        Math.trunc(fromWasm.SkipRuntime_createFor(jsu.exportString(uuid))),
      );
      if (result < 0) {
        throw this.handles.delete(-result as Handle<unknown>);
      }
    };
    this.env.shared.set(
      "SKStore",
      new SKStoreFactoryImpl(
        () => new ContextImpl(skjson(), fromWasm, this.handles, ref),
        create,
        (dbName, asWorker) =>
          (this.env.shared.get("SKDB") as SKDBShared).createSync(
            dbName,
            asWorker,
          ),
      ),
    );
  };
}

class Manager implements ToWasmManager {
  env: Environment;

  constructor(env: Environment) {
    this.env = env;
  }

  prepare = (wasm: object) => {
    const toWasm = wasm as ToWasm;
    const links = new LinksImpl(this.env);
    toWasm.SKIP_SKStore_detachHandle = <T>(fn: Handle<T>) => {
      links.detachHandle(fn);
    };
    toWasm.SKIP_SKStore_applyMapFun = <
      K extends TJSON,
      V extends TJSON,
      K2 extends TJSON,
      V2 extends TJSON,
    >(
      fn: Handle<(key: K, it: NonEmptyIterator<V>) => Iterable<[K2, V2]>>,
      context: ptr<Internal.Context>,
      writer: ptr<Internal.TWriter>,
      key: ptr<Internal.CJSON>,
      it: ptr<Internal.NonEmptyIterator>,
    ) => {
      links.applyMapFun(fn, context, writer, key, it);
    };
    toWasm.SKIP_SKStore_applyMapTableFun = <
      R extends TJSON,
      K extends TJSON,
      V extends TJSON,
    >(
      fn: Handle<(row: R, occ: number) => Iterable<[K, V]>>,
      context: ptr<Internal.Context>,
      writer: ptr<Internal.TWriter>,
      row: ptr<Internal.CJArray>,
      occ: int,
    ) => {
      links.applyMapTableFun(fn, context, writer, row, occ);
    };
    toWasm.SKIP_SKStore_applyConvertToRowFun = <
      R extends TJSON,
      K extends TJSON,
      V extends TJSON,
    >(
      fn: Handle<(key: K, it: NonEmptyIterator<V>) => R>,
      key: ptr<Internal.CJSON>,
      it: ptr<Internal.NonEmptyIterator>,
    ) => links.applyConvertToRowFun(fn, key, it);
    toWasm.SKIP_SKStore_init = (context: ptr<Internal.Context>) => {
      links.init(context);
    };
    toWasm.SKIP_SKStore_applyLazyFun = <K extends TJSON, V extends TJSON>(
      fn: Handle<(selfHdl: LazyCollection<K, V>, key: K) => Opt<V>>,
      context: ptr<Internal.Context>,
      self: ptr<Internal.LHandle>,
      key: ptr<Internal.CJSON>,
    ) => links.applyLazyFun(fn, context, self, key);

    toWasm.SKIP_SKStore_applyParamsFun = <K extends TJSON, P extends TJSON>(
      fn: Handle<(key: K) => P>,
      context: ptr<Internal.Context>,
      key: ptr<Internal.CJSON>,
    ) => links.applyParamsFun(fn, context, key);
    toWasm.SKIP_SKStore_applyLazyAsyncFun = <
      K extends TJSON,
      V extends TJSON,
      P extends TJSON,
      M extends TJSON,
    >(
      fn: Handle<(key: K, params: P) => Promise<AValue<V, M>>>,
      call: ptr<Internal.String>,
      name: ptr<Internal.String>,
      key: ptr<Internal.CJSON>,
      param: ptr<Internal.CJSON>,
    ) => {
      links.applyLazyAsyncFun(fn, call, name, key, param);
    };
    toWasm.SKIP_SKStore_applyAccumulate = <T extends TJSON, V extends TJSON>(
      fn: Handle<Accumulator<T, V>>,
      acc: ptr<Internal.CJSON>,
      value: ptr<Internal.CJSON>,
    ) => links.applyAccumulate(fn, acc, value);
    toWasm.SKIP_SKStore_applyDismiss = <T extends TJSON, V extends TJSON>(
      fn: Handle<Accumulator<T, V>>,
      acc: ptr<Internal.CJSON>,
      value: ptr<Internal.CJSON>,
    ) => links.applyDismiss(fn, acc, value);
    toWasm.SKIP_SKStore_getErrorHdl = (exn: ptr<Internal.Exception>) =>
      links.getErrorHdl(exn);
    return links;
  };
}

/* @sk init */
export function init(env: Environment) {
  return Promise.resolve(new Manager(env));
}
