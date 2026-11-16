# Tavern extension SDK (vendored)

These files are the public v1 extension SDK of Kaleidoscope Tavern (Unofficial),
copied from `sdk/` of https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial
(commit 896d023), as its SDK asks: "Copy these SDK files into YOUR add-on".

They are under the BSD 3-Clause License in `LICENSE` (Copyright (c) 2025,
Kaleidoscope Official Production Team). One change: `tavern-extension-client.js`
drops its re-export of `tavern-foundation-client.js` (effect snapshots), which
Ranching does not use and does not ship.

Do not edit these files; take a newer copy from the Tavern repository instead.
