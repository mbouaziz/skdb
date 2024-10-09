import express from "express";
import type { Entry, TJSON, SkipRuntime } from "@skipruntime/core";
import { UnknownCollectionError } from "@skipruntime/core";

export function createRESTServer(runtime: SkipRuntime): express.Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // READS
  app.head("/v1/:resource", (req, res) => {
    const resourceName = req.params.resource;
    const strReactiveAuth = req.headers["x-reactive-auth"] as string;
    if (!strReactiveAuth) throw new Error("X-Reactive-Auth must be specified.");
    const reactiveAuth = new Uint8Array(Buffer.from(strReactiveAuth, "base64"));
    try {
      const data = runtime.createResource(
        resourceName,
        req.query as Record<string, string>,
        reactiveAuth,
      );
      res.set(
        "Skip-Reactive-Response-Token",
        JSON.stringify(data, (_key: string, value: unknown) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      );
      res.status(200).json({});
    } catch (e: unknown) {
      res.status(500).json(e instanceof Error ? e.message : e);
    }
  });
  app.get("/v1/:resource/:key", (req, res) => {
    const key = req.params.key;
    const resourceName = req.params.resource;
    try {
      const data = runtime.getOne(
        resourceName,
        req.query as Record<string, string>,
        key,
      );
      res.status(200).json(data);
    } catch (e: unknown) {
      res.status(500).json(e instanceof Error ? e.message : e);
    }
  });
  app.get("/v1/:resource", (req, res) => {
    const resourceName = req.params.resource;
    const strReactiveAuth = req.headers["x-reactive-auth"] as string;
    const reactiveAuth = strReactiveAuth
      ? new Uint8Array(Buffer.from(strReactiveAuth, "base64"))
      : undefined;
    try {
      const data = runtime.getAll(
        resourceName,
        req.query as Record<string, string>,
        reactiveAuth,
      );
      if (data.reactive) {
        res.set("Skip-Reactive-Response-Token", JSON.stringify(data.reactive));
      }
      res.status(200).json(data.values);
    } catch (e: unknown) {
      res.status(500).json(e instanceof Error ? e.message : e);
    }
  });
  // WRITES
  app.put("/v1/:collection/:id", (req, res) => {
    if (!Array.isArray(req.body)) {
      res.status(400).json(`Bad request body ${JSON.stringify(req.body)}`);
      return;
    }
    const key = req.params.id;
    const data = req.body as TJSON[];
    const collectionName = req.params.collection;
    try {
      runtime.update(collectionName, [[key, [data]]]);
      res.status(200).json({});
    } catch (e: unknown) {
      if (e instanceof UnknownCollectionError) {
        res.status(400).json("Bad request");
      } else {
        res.status(500).json(e instanceof Error ? e.message : e);
      }
    }
  });
  app.patch("/v1/:collection", (req, res) => {
    if (!Array.isArray(req.body)) {
      res.status(400).json(`Bad request body ${JSON.stringify(req.body)}`);
      return;
    }
    const data = req.body as Entry<TJSON, TJSON>[];
    const collectionName = req.params.collection;
    try {
      runtime.update(collectionName, data);
      res.status(200).json({});
    } catch (e: unknown) {
      if (e instanceof UnknownCollectionError) {
        res.status(400).json("Bad request");
      } else {
        res.status(500).json(e instanceof Error ? e.message : e);
      }
    }
  });
  app.delete("/v1/:collection/:id", (req, res) => {
    const key = req.params.id;
    const collectionName = req.params.collection;
    try {
      runtime.update(collectionName, [[key, []]]);
      res.status(200).json({});
    } catch (e: unknown) {
      if (e instanceof UnknownCollectionError) {
        res.status(400).json("Bad request");
      } else {
        res.status(500).json(e instanceof Error ? e.message : e);
      }
    }
  });

  return app;
}
