// Points `@minecraft/server` imports at the in-memory mock.
// Used as: node --import ./tools/test/register.mjs tools/test/run.mjs
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      const mock = ${JSON.stringify(new URL("./mock-server.mjs", import.meta.url).href)};
      export async function resolve(specifier, context, next) {
        if (specifier === "@minecraft/server") return { url: mock, shortCircuit: true };
        if (specifier === "@minecraft/server-ui") return { url: "data:text/javascript,export {}", shortCircuit: true };
        return next(specifier, context);
      }
    `),
  import.meta.url
);
