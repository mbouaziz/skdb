import type {
  Context,
  EagerCollection,
  NonEmptyIterator,
  SkipService,
  Resource,
  Json,
} from "@skipruntime/api";
import { ManyToOneMapper } from "@skipruntime/api";
import { SkipExternalService } from "@skipruntime/helpers";

import { runService } from "@skipruntime/server";

class Mult extends ManyToOneMapper<string, number, number> {
  mapValues(values: NonEmptyIterator<number>): number {
    return values.toArray().reduce((p, c) => p * c, 1);
  }
}

class MultResource implements Resource {
  reactiveCompute(
    _collections: Record<string, EagerCollection<Json, Json>>,
    context: Context,
  ): EagerCollection<string, number> {
    const sub = context.useExternalResource<string, number>({
      supplier: "sumexample",
      resource: "sub",
    });
    const add = context.useExternalResource<string, number>({
      supplier: "sumexample",
      resource: "add",
    });
    return sub.merge(add).map(Mult);
  }
}

class Service implements SkipService {
  resources = { data: MultResource };
  externalServices = {
    sumexample: SkipExternalService.direct({ host: "localhost", port: 3587 }),
  };

  reactiveCompute(
    inputCollections: Record<string, EagerCollection<string, number>>,
  ) {
    return inputCollections;
  }
}

const closable = await runService(new Service(), 3588);

function shutdown() {
  closable.close();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
