// Points @minecraft/* imports at M2's own mock for tools/test/m2/sim.mjs.
// Used as: node --import ./tools/test/m2/register.mjs tools/test/m2/sim.mjs
import { register } from "node:module";

const mock = (name) => new URL(`./mock/@minecraft/${name}/index.js`, import.meta.url).href;
register(
  "data:text/javascript," +
    encodeURIComponent(`
      const server = ${JSON.stringify(mock("server"))};
      const ui = ${JSON.stringify(mock("server-ui"))};
      export async function resolve(specifier, context, next) {
        if (specifier === "@minecraft/server") return { url: server, shortCircuit: true };
        if (specifier === "@minecraft/server-ui") return { url: ui, shortCircuit: true };
        return next(specifier, context);
      }
    `),
  import.meta.url
);
