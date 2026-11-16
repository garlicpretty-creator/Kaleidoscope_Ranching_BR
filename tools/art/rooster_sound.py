#!/usr/bin/env python3
"""Synthesizes the rooster crow (packs/RP/sounds/kaleidoscope_ranching/rooster_crow.ogg).

A placeholder made from numbers, not a recording: four syllables ("cock-a-doodle-doo"),
each a bright harmonic tone shaped by three formants, with pitch jitter and a little
rasp; the last syllable rises, holds with vibrato and falls away. Deterministic (fixed
seed). Replace the .ogg with a real recording at any time; sound_definitions.json only
names the file.

Needs numpy and ffmpeg (with libvorbis) on PATH.
Run with: python tools/art/rooster_sound.py
"""
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "packs" / "RP" / "sounds" / "kaleidoscope_ranching" / "rooster_crow.ogg"
SR = 44100
rng = np.random.default_rng(1105)

FORMANTS = [(1150, 260, 1.0), (2500, 420, 0.55), (3600, 600, 0.25)]  # centre, width, gain


def formant_gain(freq):
    g = 0.08
    for centre, width, gain in FORMANTS:
        g += gain * np.exp(-0.5 * ((freq - centre) / width) ** 2)
    return g


def syllable(duration, contour, vibrato=0.0, rasp=0.12):
    """contour(t in 0..1) -> f0 in Hz."""
    n = int(duration * SR)
    t = np.arange(n) / SR
    u = t / duration
    f0 = contour(u) * (1 + 0.012 * rng.standard_normal(n).cumsum() / np.sqrt(np.arange(1, n + 1)))
    if vibrato:
        f0 = f0 + vibrato * np.sin(2 * np.pi * 6.5 * t) * np.clip(u * 3 - 0.6, 0, 1)
    phase = 2 * np.pi * np.cumsum(f0) / SR
    out = np.zeros(n)
    for k in range(1, 24):
        fk = f0 * k
        out += np.where(fk < SR / 2 - 500, formant_gain(fk) / k ** 0.6, 0) * np.sin(k * phase)
    # rasp: a sub-harmonic flutter and breath noise riding the tone
    out *= 1 + rasp * np.sin(phase / 2)
    noise = rng.standard_normal(n)
    noise = np.convolve(noise, np.ones(6) / 6, mode="same")
    out += 0.06 * noise * np.abs(out).mean() * 4
    attack, release = int(0.018 * SR), int(min(0.08, duration * 0.35) * SR)
    env = np.ones(n)
    env[:attack] = np.linspace(0, 1, attack)
    env[-release:] *= np.linspace(1, 0, release) ** 1.5
    return out * env


def silence(seconds):
    return np.zeros(int(seconds * SR))


def crow():
    lin = lambda a, b: (lambda u: a + (b - a) * u)
    last = lambda u: np.where(u < 0.18, 820 + (1060 - 820) * (u / 0.18), 1060 - 300 * np.clip((u - 0.18) / 0.82, 0, 1) ** 1.6)
    parts = [
        syllable(0.11, lin(520, 610)), silence(0.05),
        syllable(0.09, lin(600, 650)), silence(0.04),
        syllable(0.17, lin(700, 830)), silence(0.05),
        syllable(0.85, last, vibrato=22, rasp=0.18) * np.linspace(1, 0.55, int(0.85 * SR)),
        silence(0.15),
    ]
    sound = np.concatenate(parts)
    return sound / np.abs(sound).max() * 0.89


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".wav")
    pcm = (crow() * 32767).astype(np.int16)
    with wave.open(str(tmp), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-c:a", "libvorbis", "-q:a", "5",
                    "-map_metadata", "-1", "-fflags", "+bitexact", str(OUT)], check=True)
    tmp.unlink()
    print(f"rooster_sound: {OUT.relative_to(ROOT)} ({len(pcm) / SR:.2f} s)")


if __name__ == "__main__":
    main()
