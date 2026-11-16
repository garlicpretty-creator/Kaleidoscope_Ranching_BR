"""Loaded by every Python step of `npm run generate` (tools/generate.mjs puts this folder on
PYTHONPATH). On Windows a virus scanner maps a PNG for a moment right after a generator writes
it, and the next generator that opens the same file for writing then fails with EINVAL (or a
permission error). The generators rewrite hundreds of PNGs in a row, so one run in two died.
This makes open() for writing wait and try again instead.
"""
import builtins
import errno
import sys
import time

if sys.platform == "win32":
    _open = builtins.open

    def _patient_open(file, mode="r", *args, **kwargs):
        if not any(c in mode for c in "wax+"):
            return _open(file, mode, *args, **kwargs)
        for attempt in range(50):
            try:
                return _open(file, mode, *args, **kwargs)
            except OSError as error:
                if error.errno not in (errno.EINVAL, errno.EACCES) or attempt == 49:
                    raise
                time.sleep(0.05 * (attempt + 1))

    builtins.open = _patient_open
    import io

    io.open = _patient_open
