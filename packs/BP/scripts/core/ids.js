// Identifier helpers shared by every system.

import { NAMESPACE } from "../data/items.js";

export { NAMESPACE };

/** Full identifier for a Ranching id; vanilla and other namespaced ids pass through. */
export function rid(id) {
  return id.includes(":") ? id : `${NAMESPACE}:${id}`;
}

/** Short Ranching id, or null when the identifier belongs to another namespace. */
export function shortId(typeId) {
  const prefix = NAMESPACE + ":";
  return typeId?.startsWith(prefix) ? typeId.slice(prefix.length) : null;
}

/** Entity property holding an animal's sex ("female" | "male"). */
export const SEX_PROPERTY = `${NAMESPACE}:sex`;

/** Dynamic-property key in Ranching's namespace. */
export function dp(key) {
  return `${NAMESPACE}:${key}`;
}
