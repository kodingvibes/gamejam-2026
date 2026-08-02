#!/usr/bin/env python3
"""Convierte un export del beatmapper + el audio en el schema maestro del juego.

Las marcas a mano dicen QUE hay y DONDE mas o menos; el audio dice CUANDO exacto.
Salida: canales de senal (kick / accent / voice) con intensidad, sobre la grilla real.

  python3 tools/analyze.py <audio> <export.json> <salida.json>
"""
import json
import subprocess
import sys
import wave

import numpy as np

DIV = 16                      # resolucion del patron: semicorcheas
BPM_RANGE = (100.0, 200.0)


def decode(path, sr=22050):
    """m4a/mp3/wav -> mono float32 a sr, via ffmpeg."""
    tmp = "/tmp/_analyze.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ac", "1", "-ar", str(sr), tmp], check=True)
    w = wave.open(tmp)
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return x, w.getframerate()


def flux(x, sr, hop=128, lo=None, hi=None, n=1024):
    """Flujo espectral positivo. Sin banda -> envolvente de amplitud (sirve para el kick)."""
    if lo is None:
        m = len(x) // hop * hop
        e = np.abs(x[:m].reshape(-1, hop)).mean(1)
    else:
        frames = np.lib.stride_tricks.sliding_window_view(x, n)[::hop]
        S = np.abs(np.fft.rfft(frames * np.hanning(n), axis=1))
        f = np.fft.rfftfreq(n, 1 / sr)
        e = S[:, (f > lo) & (f < hi)].sum(1)
    d = np.diff(e, prepend=e[0])
    d[d < 0] = 0
    return d, sr / hop


def comb(d, fps, period, t0, t1, step=0.0002):
    """Mejor fase de un peine de periodo dado: devuelve (score, fase)."""
    ks = np.arange(int((t1 - t0) / period))
    best = (-1.0, 0.0)
    for ph in np.arange(0, period, step):
        idx = (t0 + ph + ks * period) * fps
        i0 = idx.astype(int)
        f = idx - i0
        v = d[i0] * (1 - f) + d[np.minimum(i0 + 1, len(d) - 1)] * f
        if v.mean() > best[0]:
            best = (v.mean(), ph)
    return best


def find_tempo(d, fps, t0, t1):
    """BPM por peine grueso y luego fino. El maximo global gana por goleada si el tema esta cuadriculado."""
    coarse = max((comb(d, fps, 60 / b, t0, t1, 0.005)[0], b) for b in np.arange(*BPM_RANGE, 0.25))
    bpm = max((comb(d, fps, 60 / b, t0, t1, 0.001)[0], b)
              for b in np.arange(coarse[1] - 0.3, coarse[1] + 0.3, 0.005))[1]
    beat = 60 / bpm
    return bpm, (t0 + comb(d, fps, beat, t0, t1)[1]) % beat   # fase absoluta, no relativa a t0


def bar_profile(d, fps, t0, bar, nbars):
    """Intensidad media en cada subdivision del compas, promediando nbars compases."""
    P = np.zeros(DIV)
    for k in range(nbars):
        for j in range(DIV):
            P[j] += d[int((t0 + k * bar + j * bar / DIV) * fps)]
    return P / (P.max() + 1e-12)


def peaks_of(P, floor=0.5):
    """Subdivisiones que son maximo local y superan el umbral -> el patron del compas."""
    return [j for j in range(DIV)
            if P[j] >= floor and P[j] >= P[(j - 1) % DIV] and P[j] >= P[(j + 1) % DIV]]


def main(audio, export, out):
    doc = json.load(open(export))
    x, sr = decode(audio)
    dur = len(x) / sr

    low, fpl = flux(x, sr)                       # kick
    mid, fpm = flux(x, sr, lo=200, hi=6000)      # acentos melodicos

    # --- grilla real ---
    a, b = doc["track"]["trim"]["start"], doc["track"]["trim"]["end"]
    bpm, phase = find_tempo(low, fpl, max(0, a - 10), min(dur, b + 40))
    beat = 60 / bpm
    bar = 4 * beat

    # Downbeat: con kick a negras los 4 beats empatan, asi que lo anclamos al drop.
    # El salto de energia mas grande del corte cae siempre en el primer tiempo de un compas.
    beats = np.arange(int((a - phase) / beat), int((b - phase) / beat))
    rms = np.array([np.sqrt((x[int((phase + k * beat) * sr):int((phase + (k + 1) * beat) * sr)] ** 2).mean())
                    for k in beats])
    drop_beat = beats[int(np.argmax(np.diff(rms, prepend=rms[0])))]
    off = (phase + drop_beat * beat) % bar
    print(f"drop en {phase + drop_beat * beat:.3f}s -> ese es el primer tiempo de compas")
    print(f"bpm {bpm:.3f}  beat {beat:.6f}s  compas {bar:.6f}s  offset {off:.4f}s")

    # --- limites a compas ---
    def snap_bar(t):
        return off + round((t - off) / bar) * bar

    t_a, t_b = snap_bar(a), snap_bar(b)
    secs = []
    for s in sorted(doc["sections"], key=lambda s: s["start"]):
        s0, s1 = max(snap_bar(s["start"]), t_a), min(snap_bar(s["end"]), t_b)
        if s1 > s0:
            secs.append({"id": s["id"], "label": s["label"], "start": s0, "end": s1})
    print("secciones:", [(s["label"], round(s["start"], 3), round(s["end"], 3)) for s in secs])

    # --- canales: patron por seccion, expandido compas a compas ---
    events = []
    for s in secs:
        n = int(round((s["end"] - s["start"]) / bar))
        if n < 1:
            continue
        for tag, d_, fps_ in (("kick", low, fpl), ("accent", mid, fpm)):
            P = bar_profile(d_, fps_, s["start"], bar, n)
            pat = peaks_of(P)
            print(f"  {s['label']:<8} {tag:<7} 1/16 {pat}")
            for k in range(n):
                for j in pat:
                    events.append({"t": s["start"] + k * bar + j * bar / DIV,
                                   "tag": tag, "v": round(float(P[j]), 3), "src": "audio"})

    # One-shots (voz, riser): no son senal periodica, se respeta la marca a mano tal cual.
    # --oneshot t0:t1 sobreescribe el tiempo de la primera, para cuando lo cronometraste a oido.
    over = [a.split("=")[1] for a in sys.argv[4:] if a.startswith("--oneshot=")]
    for e in doc["events"]:
        if "voice" in e["tag"] or "acid" in e["tag"]:
            t, d = e["t"], e.get("dur")
            if over:
                t0, t1 = (float(v) for v in over.pop(0).split(":"))
                t, d = t0, t1 - t0
            ev = {"t": t, "tag": "voice", "v": 1.0, "src": "manual"}
            if d:
                ev["dur"] = d
            events.append(ev)

    events = [e for e in events if t_a <= e["t"] < t_b]
    events.sort(key=lambda e: e["t"])

    tempo = {"bpm": round(bpm, 4), "offset": round(off, 6), "beatsPerBar": 4}
    for e in events:
        e["t"] = round(e["t"], 6)
        e["beat"] = round((e["t"] - off) / beat, 4)
        e["section"] = next((s["id"] for s in secs if s["start"] <= e["t"] < s["end"]), None)

    doc2 = {
        "version": 1,
        "track": {"name": doc["track"]["name"], "duration": round(dur, 6),
                  "trim": {"start": round(t_a, 6), "end": round(t_b, 6)}},
        "tempo": tempo,
        "sections": [{k: (round(v, 6) if isinstance(v, float) else v) for k, v in s.items()} for s in secs],
        "tags": [{"id": "kick", "key": "1", "color": "#ef4444"},
                 {"id": "accent", "key": "2", "color": "#eab308"},
                 {"id": "voice", "key": "3", "color": "#22c55e"}],
        "events": events,
    }
    json.dump(doc2, open(out, "w"), indent=1)
    print(f"{out}: {len(events)} eventos, corte {t_b - t_a:.3f}s = {round((t_b - t_a) / bar)} compases")


if __name__ == "__main__":
    main(*sys.argv[1:4])
