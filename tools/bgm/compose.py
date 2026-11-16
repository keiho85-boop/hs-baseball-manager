"""
転生名将ナギのBGMを作る（すべてこのプログラムで作曲・合成する。外部の音源や曲は使わない）。
使い方: python3 tools/bgm/compose.py  → public/bgm/*.m4a を書き出す
"""
import os, subprocess, sys
import numpy as np
from scipy.signal import lfilter, butter, fftconvolve

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'bgm')

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def chord_notes(name, octave=4):
    """'C', 'Am', 'F', 'G7', 'Dm7', 'Fmaj7', 'Esus4' → MIDI番号の並び"""
    root = name[0] + (name[1] if len(name) > 1 and name[1] in '#b' else '')
    q = name[len(root):]
    r = 12 * (octave + 1) + NOTE[root]
    if q.startswith('m') and not q.startswith('maj'):
        iv = [0, 3, 7]
        q = q[1:]
    elif q.startswith('sus4'):
        iv = [0, 5, 7]
        q = q[4:]
    elif q.startswith('dim'):
        iv = [0, 3, 6]
        q = q[3:]
    else:
        iv = [0, 4, 7]
    if q == '7':
        iv = iv + [10]
    elif q == 'maj7':
        iv = iv + [11]
    elif q == 'add9':
        iv = iv + [14]
    return [r + i for i in iv]


# ---------------------------------------------------------------- 音色

def env(n, a, d, s, r, sustain_len):
    """ADSR（秒）。n は全体の長さ（サンプル）"""
    e = np.zeros(n)
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    S_end = min(n, int(sustain_len * SR))
    i = 0
    if A > 0:
        k = min(A, n)
        e[:k] = np.linspace(0, 1, A)[:k]
        i = k
    if i < S_end and D > 0:
        k = min(D, S_end - i)
        e[i:i + k] = np.linspace(1, s, D)[:k]
        i += k
    if i < S_end:
        e[i:S_end] = s
        i = S_end
    last = e[i - 1] if i > 0 else 0
    if i < n:
        k = min(R, n - i)
        e[i:i + k] = np.linspace(last, 0, max(1, R))[:k]
    return e


def saw(f, t, detune=0.0):
    ph = (f * (1 + detune)) * t
    return 2 * (ph - np.floor(ph + 0.5))


def lowpass(x, cutoff, order=2):
    b, a = butter(order, min(0.99, cutoff / (SR / 2)), 'low')
    return lfilter(b, a, x)


def highpass(x, cutoff, order=2):
    b, a = butter(order, min(0.99, cutoff / (SR / 2)), 'high')
    return lfilter(b, a, x)


def inst(kind, m, dur, vel=1.0):
    f = hz(m)
    tail = {'piano': 1.6, 'pluck': 0.9, 'pad': 1.2, 'lead': 0.25, 'brass': 0.25, 'bass': 0.15, 'bell': 2.5, 'strings': 0.6, 'flute': 0.2, 'marimba': 0.6}[kind]
    n = int((dur + tail) * SR)
    t = np.arange(n) / SR
    if kind == 'piano':
        x = np.zeros(n)
        for h, a in [(1, 1), (2, 0.45), (3, 0.22), (4, 0.12), (5, 0.06), (6, 0.03)]:
            x += a * np.sin(2 * np.pi * f * h * (1 + 0.0004 * h * h) * t) * np.exp(-t * (1.6 + h * 0.9) * (f / 440) ** 0.3)
        x *= env(n, 0.004, 0.1, 0.85, 0.25, dur)
    elif kind == 'marimba':
        x = np.sin(2 * np.pi * f * t) * np.exp(-t * 5) + 0.3 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 14)
    elif kind == 'pluck':
        x = np.zeros(n)
        for h in range(1, 9):
            x += (1 / h) * np.sin(2 * np.pi * f * h * t) * np.exp(-t * (3 + h * 1.6))
        x *= env(n, 0.002, 0.05, 1, 0.1, dur + 0.4)
    elif kind == 'pad':
        x = (saw(f, t, -0.004) + saw(f, t, 0.004) + 0.5 * saw(f / 2, t)) / 2.5
        x = lowpass(x, 1400 + 400 * vel)
        x *= env(n, 0.35, 0.3, 0.8, 1.0, dur)
    elif kind == 'strings':
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t * 2, 0, 1)
        x = (saw(f * vib, t, -0.003) + saw(f * vib, t, 0.003)) / 2
        x = lowpass(x, 2600)
        x *= env(n, 0.12, 0.2, 0.85, 0.5, dur)
    elif kind == 'lead':
        vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.15) * 3, 0, 1)
        x = 0.6 * saw(f * vib, t) + 0.4 * np.sign(np.sin(2 * np.pi * f * vib * t))
        x = lowpass(x, 3200)
        x *= env(n, 0.01, 0.1, 0.75, 0.12, dur)
    elif kind == 'flute':
        vib = 1 + 0.005 * np.sin(2 * np.pi * 5 * t) * np.clip((t - 0.1) * 3, 0, 1)
        x = np.sin(2 * np.pi * f * vib * t) + 0.18 * np.sin(4 * np.pi * f * vib * t) + 0.02 * np.random.default_rng(int(m * 100 + dur * 10)).standard_normal(n)
        x = lowpass(x, 5000)
        x *= env(n, 0.05, 0.1, 0.85, 0.12, dur)
    elif kind == 'brass':
        x = (saw(f, t, -0.002) + saw(f, t, 0.002)) / 2
        # 吹き始めに明るくなる
        bright = lowpass(x, 4200)
        dark = lowpass(x, 1100)
        k = np.clip(1 - t / 0.25, 0, 1)
        x = bright * k + dark * (1 - k) * 1.2
        x *= env(n, 0.03, 0.15, 0.8, 0.12, dur)
    elif kind == 'bass':
        x = 0.7 * np.sin(2 * np.pi * f * t) + 0.35 * saw(f, t)
        x = lowpass(x, 700)
        x *= env(n, 0.005, 0.1, 0.8, 0.08, dur)
    elif kind == 'bell':
        mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.2 * np.exp(-t * 3)
        x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 1.6)
    return x * vel


def drum(kind, vel=1.0, seed=0):
    rng = np.random.default_rng(seed)
    if kind == 'kick':
        n = int(0.35 * SR)
        t = np.arange(n) / SR
        fr = 48 + 90 * np.exp(-t * 30)
        x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 9)
    elif kind == 'snare':
        n = int(0.25 * SR)
        t = np.arange(n) / SR
        x = 0.7 * highpass(rng.standard_normal(n), 1200) * np.exp(-t * 16) + 0.5 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 22)
    elif kind == 'hat':
        n = int(0.06 * SR)
        t = np.arange(n) / SR
        x = 0.35 * highpass(rng.standard_normal(n), 7000) * np.exp(-t * 60)
    elif kind == 'ohat':
        n = int(0.25 * SR)
        t = np.arange(n) / SR
        x = 0.3 * highpass(rng.standard_normal(n), 6500) * np.exp(-t * 11)
    elif kind == 'crash':
        n = int(1.8 * SR)
        t = np.arange(n) / SR
        x = 0.45 * highpass(rng.standard_normal(n), 4000) * np.exp(-t * 2.2)
    elif kind == 'tom':
        n = int(0.3 * SR)
        t = np.arange(n) / SR
        fr = 110 + 60 * np.exp(-t * 20)
        x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 10)
    elif kind == 'shaker':
        n = int(0.08 * SR)
        t = np.arange(n) / SR
        x = 0.25 * highpass(rng.standard_normal(n), 5000) * np.sin(np.pi * np.clip(t / 0.08, 0, 1))
    return x * vel


# ---------------------------------------------------------------- 曲の組み立て

class Song:
    def __init__(self, bpm, bars, beats=4):
        self.bpm, self.bars, self.beats = bpm, bars, beats
        self.beat = 60 / bpm
        self.length = bars * beats * self.beat
        n = int((self.length + 4) * SR)
        self.tracks = {}
        self.n = n

    def tr(self, name):
        if name not in self.tracks:
            self.tracks[name] = np.zeros((self.n, 2))
        return self.tracks[name]

    def add(self, name, x, at_beat, pan=0.0, gain=1.0):
        i = int(at_beat * self.beat * SR)
        if i >= self.n:
            return
        x = x[: self.n - i] * gain
        L, R = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        t = self.tr(name)
        t[i:i + len(x), 0] += x * L * 1.414
        t[i:i + len(x), 1] += x * R * 1.414

    def note(self, name, kind, m, at, dur, vel=1.0, pan=0.0, gain=1.0):
        self.add(name, inst(kind, m, dur * self.beat, vel), at, pan, gain)

    def hit(self, kind, at, vel=1.0, pan=0.0, gain=1.0, seed=0):
        self.add('drums', drum(kind, vel, seed), at, pan, gain)

    def render(self, reverb=0.25, room=1.6):
        mix = np.zeros((self.n, 2))
        for name, t in self.tracks.items():
            mix += t
        # 残響（減衰する雑音の畳み込み）
        rng = np.random.default_rng(1)
        L = int(room * SR)
        ir = rng.standard_normal((L, 2)) * np.exp(-np.arange(L) / SR * (6.9 / room))[:, None]
        ir[:, 0] = lowpass(ir[:, 0], 5000)
        ir[:, 1] = lowpass(ir[:, 1], 5000)
        ir /= np.sqrt((ir ** 2).sum(axis=0))
        wet = np.stack([fftconvolve(mix[:, c], ir[:, c])[: self.n] for c in range(2)], axis=1)
        out = mix + wet * reverb
        # ループ：曲の長さで切り、はみ出した余韻を先頭に重ねる（つなぎ目で音が途切れないように）
        Ln = int(self.length * SR)
        loop = out[:Ln].copy()
        tail = out[Ln:]
        k = min(len(tail), Ln)
        loop[:k] += tail[:k]
        # 音量をそろえる（RMS）と、ゆるいリミッター
        rms = np.sqrt((loop ** 2).mean())
        loop *= 0.16 / max(rms, 1e-6)
        loop = np.tanh(loop * 1.1) / 1.1
        return loop


def melody_from(song, kind, prog, scale, rhythm_bars, start_m, inst_kind, vel=0.9, pan=0.0, gain=1.0, seed=0, octave_lock=(60, 84)):
    """コードに合わせて旋律を作る。rhythm_bars は小節ごとの音の長さ（拍）。None は休符"""
    rng = np.random.default_rng(seed)
    cur = start_m
    lo, hi = octave_lock
    beat = 0.0
    for bar, rhythm in enumerate(rhythm_bars):
        chord = chord_notes(prog[bar % len(prog)])
        tones = sorted({(c % 12) for c in chord})
        b = 0.0
        for i, d in enumerate(rhythm):
            if d is None:
                b += 0.5
                continue
            strong = (b % 2 == 0)
            last = i == len(rhythm) - 1
            cands = [m for m in range(lo, hi + 1) if (m % 12) in (tones if (strong or last) else scale)]
            # 近い音へ。ときどき跳躍
            cands.sort(key=lambda m: abs(m - cur) + (rng.random() * 3 if not strong else rng.random()))
            pick = cands[0] if rng.random() > 0.2 else cands[min(len(cands) - 1, rng.integers(1, 4))]
            if pick == cur and len(cands) > 1 and rng.random() < 0.6:
                pick = cands[1]
            cur = pick
            song.note('melody', inst_kind, cur, beat + b, d * 0.95, vel * (1.0 if strong else 0.85), pan, gain)
            b += d
        beat += song.beats


def chords_part(song, prog, kind, octave, pattern, vel=0.6, pan=0.0, gain=1.0, inv_top=None):
    """pattern: [(拍, 長さ)] の繰り返し。各小節にコードを鳴らす"""
    for bar in range(song.bars):
        ch = chord_notes(prog[bar % len(prog)], octave)
        if inv_top:
            ch = [c - 12 if c > inv_top else c for c in ch]
        for (b, d) in pattern:
            for c in ch:
                song.note('chords', kind, c, bar * song.beats + b, d, vel, pan, gain / len(ch) * 2)


def bass_part(song, prog, pattern, octave=2, vel=0.9, gain=1.0, walk=False):
    for bar in range(song.bars):
        root = chord_notes(prog[bar % len(prog)], octave)[0]
        fifth = root + 7
        for j, (b, d, which) in enumerate(pattern):
            m = root if which == 'r' else fifth if which == '5' else root + 12
            song.note('bass', 'bass', m, bar * song.beats + b, d, vel, 0, gain)


def drums_part(song, pattern, bars=None, fills=True, gain=1.0):
    """pattern: {'kick': [拍...], 'snare': [...], 'hat': [...]}（1小節ぶん）"""
    for bar in range(bars or song.bars):
        for kind, beats in pattern.items():
            for b in beats:
                song.hit(kind, bar * song.beats + b, 1.0, 0.15 if kind in ('hat', 'ohat', 'shaker') else 0, gain, seed=bar * 7 + int(b * 10))
        if fills and bar % 8 == 7:
            for k, b in enumerate([3, 3.25, 3.5, 3.75]):
                song.hit('tom' if k < 2 else 'snare', bar * song.beats + b, 0.8, 0, gain, seed=k)
        if bar % 8 == 0:
            song.hit('crash', bar * song.beats, 0.8, 0.2, gain, seed=bar)


MAJ = lambda k: [(NOTE[k] + i) % 12 for i in (0, 2, 4, 5, 7, 9, 11)]
MIN = lambda k: [(NOTE[k] + i) % 12 for i in (0, 2, 3, 5, 7, 8, 10)]


def save(name, loop):
    os.makedirs(OUT, exist_ok=True)
    wav = f'/tmp/bgm_{name}.wav'
    import wave
    data = (np.clip(loop, -1, 1) * 32767).astype('<i2')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    dst = os.path.join(OUT, f'{name}.m4a')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '96k', dst], check=True)
    print(name, f'{len(loop) / SR:.1f}s', os.path.getsize(dst) // 1024, 'KB')


# ---------------------------------------------------------------- 各曲

def home():
    """通常（ホーム）：明るく軽快。部活の日常"""
    s = Song(112, 32)
    A = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G']
    B = ['Am', 'Em', 'F', 'C', 'Dm', 'G', 'C', 'G']
    prog = A + A + B + A
    chords_part(s, prog, 'piano', 4, [(0, 1.5), (1.5, 1), (2.5, 1.5)], vel=0.5, pan=-0.2, gain=0.55)
    bass_part(s, prog, [(0, 1, 'r'), (1.5, 0.5, 'r'), (2, 1, '5'), (3, 1, 'o')], gain=0.7)
    drums_part(s, {'kick': [0, 2.5], 'snare': [1, 3], 'hat': [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]}, gain=0.55)
    r1 = [[1, 0.5, 0.5, 1, 1], [1.5, 0.5, 2], [1, 0.5, 0.5, 1, 1], [3, 1]]
    r2 = [[0.5, 0.5, 1, 0.5, 0.5, 1], [2, 1, 1], [0.5, 0.5, 0.5, 0.5, 1, 1], [4]]
    rh = (r1 + r1) * 2 + (r2 + r2) + (r1 + r1)
    melody_from(s, 'lead', prog, MAJ('C'), rh, 72, 'flute', vel=0.75, gain=0.6, seed=3)
    for bar in range(32):
        s.note('chords', 'marimba', chord_notes(prog[bar], 5)[bar % 3], bar * 4 + 3.5, 0.5, 0.5, 0.4, 0.25)
    return s.render(0.22)


def pref():
    """県大会：熱く、前へ進む応援の勢い"""
    s = Song(142, 32)
    A = ['Am', 'F', 'G', 'Em', 'Am', 'F', 'G', 'E']
    B = ['F', 'G', 'Em', 'Am', 'F', 'G', 'Esus4', 'E']
    prog = A + A + B + ['F', 'G', 'C', 'Am', 'F', 'G', 'Am', 'E']
    chords_part(s, prog, 'strings', 4, [(0, 0.5), (0.75, 0.5), (1.5, 0.5), (2, 0.5), (2.75, 0.5), (3.5, 0.5)], vel=0.6, pan=-0.25, gain=0.45)
    bass_part(s, prog, [(0, 0.5, 'r'), (0.5, 0.5, 'r'), (1, 0.5, 'o'), (1.5, 0.5, 'r'), (2, 0.5, 'r'), (2.5, 0.5, '5'), (3, 0.5, 'o'), (3.5, 0.5, 'r')], gain=0.75)
    drums_part(s, {'kick': [0, 1, 2, 3], 'snare': [1, 3, 3.75], 'hat': [0.5, 1.5, 2.5, 3.5], 'ohat': [3.5]}, gain=0.65)
    r1 = [[0.5, 0.5, 1, 0.5, 0.5, 1], [1, 1, 2], [0.5, 0.5, 1, 0.5, 0.5, 1], [2, 2]]
    r2 = [[1.5, 0.5, 1, 1], [1, 1, 1, 1], [1.5, 0.5, 2], [4]]
    rh = (r1 + r1) * 2 + (r2 + r2) + (r1 + r2)
    melody_from(s, 'lead', prog, MIN('A'), rh, 76, 'brass', vel=0.9, gain=0.7, seed=11)
    return s.render(0.18, 1.2)


def national():
    """全国大会：大舞台の高揚感。行進曲風"""
    s = Song(126, 32)
    A = ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A']
    B = ['G', 'A', 'F#m', 'Bm', 'Em', 'A', 'D', 'A7']
    prog = A + A + B + ['G', 'A', 'D', 'Bm', 'G', 'A', 'D', 'D']
    chords_part(s, prog, 'brass', 4, [(0, 1), (1.5, 0.5), (2, 1.5)], vel=0.7, pan=-0.2, gain=0.42)
    chords_part(s, prog, 'pad', 3, [(0, 4)], vel=0.5, pan=0.25, gain=0.3)
    bass_part(s, prog, [(0, 1, 'r'), (1, 1, '5'), (2, 1, 'r'), (3, 1, '5')], gain=0.75)
    drums_part(s, {'kick': [0, 2], 'snare': [1, 3, 3.25, 3.5], 'hat': [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]}, gain=0.6)
    r1 = [[2, 1, 1], [1.5, 0.5, 2], [1, 1, 1, 1], [3, 1]]
    r2 = [[1, 0.5, 0.5, 2], [1, 1, 2], [0.5, 0.5, 1, 1, 1], [4]]
    rh = (r1 + r1) * 2 + (r2 + r2) + (r1 + r2)
    melody_from(s, 'lead', prog, MAJ('D'), rh, 74, 'brass', vel=1.0, gain=0.75, seed=5)
    melody_from(s, 'lead', prog, MAJ('D'), rh, 74 - 12, 'strings', vel=0.6, gain=0.3, seed=5, octave_lock=(57, 79))
    return s.render(0.3, 2.0)


def camp():
    """合宿：夏の海辺。のびのびとした南国風"""
    s = Song(98, 32)
    A = ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C']
    B = ['Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'F', 'C']
    prog = A + A + B + A
    chords_part(s, prog, 'pluck', 4, [(0, 0.5), (1, 0.5), (1.5, 0.5), (2.5, 0.5), (3, 0.5)], vel=0.55, pan=-0.3, gain=0.5)
    bass_part(s, prog, [(0, 1.5, 'r'), (1.5, 0.5, '5'), (2, 1, 'o'), (3, 1, '5')], gain=0.7)
    drums_part(s, {'kick': [0, 2], 'snare': [3], 'shaker': [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]}, gain=0.5, fills=False)
    r1 = [[1.5, 0.5, 1, 1], [2, 2], [0.5, 0.5, 1, 1, 1], [4]]
    r2 = [[1, 1, 1.5, 0.5], [3, 1], [1, 0.5, 0.5, 2], [4]]
    rh = (r1 + r1) * 2 + (r2 + r2) + (r1 + r1)
    melody_from(s, 'lead', prog, MAJ('F'), rh, 72, 'marimba', vel=0.9, gain=0.7, seed=21)
    melody_from(s, 'lead', prog, MAJ('F'), rh, 77, 'flute', vel=0.5, gain=0.25, seed=21)
    return s.render(0.25)


def ending():
    """エンディング：静かで温かいバラード"""
    s = Song(70, 24)
    A = ['C', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'G']
    B = ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'C']
    prog = A + B + A
    chords_part(s, prog, 'piano', 3, [(0, 1), (1, 1), (2, 1), (3, 1)], vel=0.4, pan=-0.15, gain=0.45, inv_top=64)
    chords_part(s, prog, 'pad', 3, [(0, 4)], vel=0.35, pan=0.2, gain=0.22)
    bass_part(s, prog, [(0, 4, 'r')], gain=0.5)
    r1 = [[1, 1, 2], [1.5, 0.5, 2], [1, 1, 1, 1], [4]]
    rh = r1 * 6
    melody_from(s, 'lead', prog, MAJ('C'), rh, 72, 'piano', vel=0.75, gain=0.65, seed=8, octave_lock=(64, 84))
    melody_from(s, 'lead', prog, MAJ('C'), rh, 64, 'strings', vel=0.4, gain=0.18, seed=8, octave_lock=(55, 76))
    return s.render(0.38, 2.4)


def rare():
    """レアイベント：不思議で、少し怪しい"""
    s = Song(80, 16)
    prog = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Em', 'A7'] * 2
    chords_part(s, prog, 'pad', 3, [(0, 4)], vel=0.45, gain=0.35)
    bass_part(s, prog, [(0, 2, 'r'), (2, 2, '5')], gain=0.5)
    for bar in range(16):
        ch = chord_notes(prog[bar], 5)
        for k, b in enumerate([0, 0.75, 1.5, 2.25, 3, 3.5]):
            s.note('chords', 'bell', ch[k % len(ch)] + (12 if k == 4 else 0), bar * 4 + b, 0.5, 0.35, (-0.5 + k * 0.2), 0.18)
        s.hit('tom', bar * 4, 0.35, 0, 0.5, seed=bar)
    r = [[2, 1, 1], [3, 1], [1, 1, 2], [4]] * 4
    melody_from(s, 'lead', prog, [(NOTE['D'] + i) % 12 for i in (0, 1, 4, 5, 7, 8, 10)], r, 74, 'flute', vel=0.55, gain=0.4, seed=31)
    return s.render(0.45, 2.8)


if __name__ == '__main__':
    only = sys.argv[1:]
    for name, fn in [('home', home), ('pref', pref), ('national', national), ('camp', camp), ('ending', ending), ('rare', rare)]:
        if only and name not in only:
            continue
        save(name, fn())
