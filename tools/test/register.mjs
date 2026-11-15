// Points `@minecraft/server` imports at the in-memory mock.
// Used as: node --import ./tools/test/register.mjs tools/test/run.mjs
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      const mock = ${JSON.stringify(new URL("./mock-server.mjs", import.meta.url).href)};
      export async function resolve(specifier, context, next) {
        if (specifier === "@minecraft/server") return { url: mock, shortCircuit: true };
        if (specifier === "@minecraft/server-ui") {
          // Forms are not exercised here; stub classes keep imports working.
          const ui = "class Form { title() { return this; } body() { return this; } button() { return this; } textField() { return this; } toggle() { return this; } show() { return Promise.resolve({ canceled: true }); } }" +
            "export class ActionFormData extends Form {} export class ModalFormData extends Form {} export class MessageFormData extends Form {}";
          return { url: "data:text/javascript," + encodeURIComponent(ui), shortCircuit: true };
        }
        return next(specifier, context);
      }
    `),
  import.meta.url
);
