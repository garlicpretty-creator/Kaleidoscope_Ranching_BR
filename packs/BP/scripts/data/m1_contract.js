// M1 ↔ M2 contract.
// Every assumption M2 makes about M1's entities lives here, so wiring M2 onto
// the real M1 code is a one-file change. Values follow the 企劃書 wording.

export const NS = "kaleidoscope_ranching";

/** Entity family every Ranching animal carries (企劃書 · 標籤契約). */
export const FAMILY_LIVESTOCK = "ranching_livestock";
export const FAMILY_MALE = "ranching_male";
export const FAMILY_FEMALE = "ranching_female";

/**
 * Optional: dynamic property M1 writes on a pregnant female — the game day the
 * birth is due. If M1 uses another key, change it here; if absent, the
 * notebook simply shows "未懷孕".
 */
export const DP_PREGNANT_UNTIL_DAY = "kr:pregnant_until_day";

/**
 * Optional: entity event M1 defines that adds `minecraft:persistent`.
 * The ear tag calls it inside try/catch; without it the ear tag still keeps the
 * animal from despawning by giving it a name tag (named mobs never despawn).
 */
export const EVENT_ADD_EAR_TAG = `${NS}:add_ear_tag`;
