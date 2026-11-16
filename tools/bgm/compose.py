"""
転生名将ナギのBGMを作る（すべてこのプログラムで作曲・合成する。外部の音源や曲は使わない）。
使い方: python3 tools/bgm/compose.py  → public/bgm/*.mp3 を書き出す
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
    tail = {'gtr': 0.25, 'gmute': 0.08, 'glead': 0.3, 'synth': 0.2, 'piano': 1.6, 'pluck': 0.9, 'pad': 1.2, 'lead': 0.25, 'brass': 0.25, 'bass': 0.15, 'bell': 2.5, 'strings': 0.6, 'flute': 0.2, 'marimba': 0.6}[kind]
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
    elif kind in ('gtr', 'gmute'):
        # 歪んだギター：ルート・5度・オクターブ（パワーコード）。gmute はブリッジミュートの刻み
        x = np.zeros(n)
        for iv, a in [(0, 1.0), (7, 0.8), (12, 0.55)]:
            ff = f * 2 ** (iv / 12)
            x += a * (saw(ff, t, -0.003) + saw(ff, t, 0.003))
        x = np.tanh(x * 3.5)
        x = lowpass(x, 2400 if kind == 'gmute' else 3800, 2)
        x = highpass(x, 140)
        if kind == 'gmute':
            x *= np.exp(-t * 18) * env(n, 0.002, 0.03, 1, 0.04, dur)
        else:
            x *= env(n, 0.004, 0.2, 0.85, 0.15, dur)
        x *= 0.75
    elif kind == 'glead':
        # リードギター：歌うようなビブラートと、音の頭のしゃくり
        bend = 1 - 0.03 * np.exp(-t * 25)
        vib = 1 + 0.008 * np.sin(2 * np.pi * 5.8 * t) * np.clip((t - 0.18) * 3, 0, 1)
        x = saw(f * bend * vib, t, -0.002) + saw(f * bend * vib, t, 0.002)
        x = np.tanh(x * 4)
        x = lowpass(x, 3800, 2)
        x *= env(n, 0.006, 0.15, 0.8, 0.15, dur) * 0.55
    elif kind == 'synth':
        # 明るいシンセのリード（ポップの主旋律）
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.12) * 3, 0, 1)
        x = 0.5 * saw(f * vib, t, -0.006) + 0.5 * saw(f * vib, t, 0.006) + 0.3 * np.sign(np.sin(2 * np.pi * f * 2 * vib * t))
        x = lowpass(x, 5200)
        x *= env(n, 0.005, 0.12, 0.8, 0.12, dur) * 0.7
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


def phrase(song, start_bar, prog, scale, rhythm_bars, start_m, inst_kind, seed, vel=0.9, gain=1.0, pan=0.0, octave_lock=(60, 84), track='melody', shift=0):
    """start_bar から始まる区間の旋律。同じ seed・同じコードなら同じ旋律になる"""
    rng = np.random.default_rng(seed)
    cur = start_m
    lo, hi = octave_lock
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
            cands.sort(key=lambda m: abs(m - cur) + (rng.random() * 3 if not strong else rng.random()))
            pick = cands[0] if rng.random() > 0.25 else cands[min(len(cands) - 1, rng.integers(1, 4))]
            if pick == cur and len(cands) > 1 and rng.random() < 0.6:
                pick = cands[1]
            cur = pick
            song.note(track, inst_kind, cur + shift, (start_bar + bar) * song.beats + b, d * 0.92, vel * (1.0 if strong else 0.85), pan, gain)
            b += d


def rock_drums(song, bars, style='8beat', gain=1.0, start=0):
    """ロックのドラム。8beat／16beat（速いハイハット）／2beat（疾走）"""
    for bar in range(start, start + bars):
        o = bar * song.beats
        if style == '2beat':
            for b in [0, 1, 2, 3]:
                song.hit('kick', o + b, 0.7, 0, gain, seed=bar)
                song.hit('snare', o + b + 0.5, 0.9, 0, gain * 0.9, seed=bar * 3 + b)
            for b in np.arange(0, 4, 0.5):
                song.hit('hat', o + b, 0.8, 0.15, gain, seed=int(bar * 9 + b * 2))
        else:
            kicks = [0, 1.5, 2, 2.75] if style == '16beat' else [0, 0.75, 2, 2.5]
            for b in kicks:
                song.hit('kick', o + b, 0.7, 0, gain, seed=bar)
            for b in [1, 3]:
                song.hit('snare', o + b, 1.0, 0, gain, seed=bar * 3 + b)
            step = 0.25 if style == '16beat' else 0.5
            for b in np.arange(0, 4, step):
                song.hit('hat', o + b, 0.9 if b % 1 == 0 else 0.6, 0.15, gain, seed=int(bar * 9 + b * 4))
        if bar % 8 == 7:
            for k, b in enumerate([3, 3.25, 3.5, 3.75]):
                song.hit('snare' if k % 2 else 'tom', o + b, 0.9, 0, gain, seed=k + bar)
        if bar % 8 == 0:
            song.hit('crash', o, 0.9, 0.2, gain, seed=bar)


def rock_guitar(song, prog, bars, start=0, mode='mute', gain=1.0, octave=3):
    """リズムギター。mute：8分の刻み／open：コードを伸ばす／push：裏で食う"""
    for bar in range(start, start + bars):
        root = chord_notes(prog[bar % len(prog)], octave)[0]
        o = bar * song.beats
        if mode == 'mute':
            for b in np.arange(0, 4, 0.5):
                song.note('gtr', 'gmute', root, o + b, 0.45, 0.9, -0.45, gain)
                song.note('gtr2', 'gmute', root, o + b, 0.45, 0.85, 0.45, gain * 0.9)
        elif mode == 'open':
            song.note('gtr', 'gtr', root, o, 1.9, 1.0, -0.45, gain)
            song.note('gtr2', 'gtr', root, o + 2, 1.9, 0.95, 0.45, gain)
        else:
            for b, d in [(0, 1.4), (1.5, 1.0), (2.5, 1.4)]:
                song.note('gtr', 'gtr', root, o + b, d, 1.0, -0.45, gain)
                song.note('gtr2', 'gtr', root, o + b, d, 0.95, 0.45, gain * 0.9)


def rock_bass(song, prog, bars, start=0, gain=1.0):
    gain *= 0.75
    for bar in range(start, start + bars):
        root = chord_notes(prog[bar % len(prog)], 2)[0]
        for b in np.arange(0, 4, 0.5):
            m = root + (12 if b == 3.5 else 0)
            song.note('bass', 'bass', m, bar * song.beats + b, 0.45, 0.95 if b % 1 == 0 else 0.8, 0, gain)


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
    dst = os.path.join(OUT, f'{name}.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '112k', dst], check=True)
    print(name, f'{len(loop) / SR:.1f}s', os.path.getsize(dst) // 1024, 'KB')


# ---------------------------------------------------------------- 各曲

def home():
    """通常（ホーム）：明るいポップロック。部活の毎日のワクワク"""
    s = Song(132, 32)
    A = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G']
    B = ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'G']
    prog = A + A + B + A
    rock_drums(s, 32, '8beat', 0.6)
    rock_bass(s, prog, 32, gain=0.7)
    rock_guitar(s, prog, 16, 0, 'push', 0.32)
    rock_guitar(s, prog, 8, 16, 'mute', 0.3)
    rock_guitar(s, prog, 8, 24, 'push', 0.32)
    chords_part(s, prog, 'piano', 4, [(0, 0.5), (1.5, 0.5), (2, 0.5), (3.5, 0.5)], vel=0.5, pan=0.3, gain=0.3)
    ra = [[0.5, 0.5, 1, 0.5, 0.5, 1], [1.5, 0.5, 2], [0.5, 0.5, 1, 0.5, 0.5, 1], [3, 1]] * 2
    rb = [[1, 0.5, 0.5, 1, 1], [1, 1, 2], [0.5, 0.5, 0.5, 0.5, 1, 1], [4]] * 2
    phrase(s, 0, A, MAJ('C'), ra, 72, 'synth', seed=3, gain=0.55)
    phrase(s, 8, A, MAJ('C'), ra, 72, 'synth', seed=3, gain=0.55)
    phrase(s, 16, B, MAJ('C'), rb, 72, 'glead', seed=7, gain=0.5)
    phrase(s, 24, A, MAJ('C'), ra, 72, 'synth', seed=3, gain=0.55)
    phrase(s, 24, A, MAJ('C'), ra, 72, 'glead', seed=3, gain=0.25, shift=-12, octave_lock=(60, 84))
    return s.render(0.14, 1.1)


def pref():
    """県大会・練習試合：気合の入る疾走ロック"""
    s = Song(168, 32)
    A = ['Am', 'F', 'G', 'Em', 'Am', 'F', 'G', 'E']
    B = ['F', 'G', 'Am', 'Am', 'F', 'G', 'E', 'E']
    C = ['F', 'G', 'C', 'Am', 'F', 'G', 'Am', 'E']
    prog = A + A + B + C
    rock_drums(s, 16, '8beat', 0.7)
    rock_drums(s, 8, '16beat', 0.7, start=16)
    rock_drums(s, 8, '2beat', 0.7, start=24)
    rock_bass(s, prog, 32, gain=0.8)
    rock_guitar(s, prog, 16, 0, 'mute', 0.36)
    rock_guitar(s, prog, 8, 16, 'push', 0.36)
    rock_guitar(s, prog, 8, 24, 'open', 0.36)
    ra = [[0.5, 0.5, 0.5, 0.5, 1, 1], [1, 1, 2], [0.5, 0.5, 0.5, 0.5, 1, 1], [2, 2]] * 2
    rc = [[1.5, 0.5, 1, 1], [1, 1, 1, 1], [1.5, 0.5, 2], [4]] * 2
    phrase(s, 0, A, MIN('A'), ra, 76, 'glead', seed=11, gain=0.6)
    phrase(s, 8, A, MIN('A'), ra, 76, 'glead', seed=11, gain=0.6)
    phrase(s, 16, B, MIN('A'), rc, 76, 'brass', seed=13, gain=0.55)
    phrase(s, 24, C, MAJ('C'), rc, 79, 'glead', seed=17, gain=0.65)
    phrase(s, 24, C, MAJ('C'), rc, 79, 'brass', seed=17, gain=0.3, shift=-12, octave_lock=(60, 88))
    return s.render(0.12, 1.0)


def national():
    """全国大会：大舞台の熱いアンセム・ロック"""
    s = Song(152, 32)
    A = ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A']
    B = ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'Bm', 'A']
    C = ['G', 'A', 'D', 'Bm', 'G', 'A', 'D', 'A']
    prog = A + A + B + C
    rock_drums(s, 16, '8beat', 0.7)
    rock_drums(s, 8, '16beat', 0.7, start=16)
    rock_drums(s, 8, '8beat', 0.75, start=24)
    rock_bass(s, prog, 32, gain=0.8)
    rock_guitar(s, prog, 8, 0, 'open', 0.36)
    rock_guitar(s, prog, 16, 8, 'mute', 0.34)
    rock_guitar(s, prog, 8, 24, 'push', 0.38)
    chords_part(s, prog, 'brass', 4, [(0, 1.5), (1.5, 0.5), (2, 2)], vel=0.7, pan=0.25, gain=0.25)
    ra = [[2, 1, 1], [1.5, 0.5, 2], [1, 1, 1, 1], [3, 1]] * 2
    rc = [[1, 0.5, 0.5, 2], [1, 1, 2], [0.5, 0.5, 1, 1, 1], [4]] * 2
    phrase(s, 0, A, MAJ('D'), ra, 74, 'glead', seed=5, gain=0.6)
    phrase(s, 8, A, MAJ('D'), ra, 74, 'glead', seed=5, gain=0.6)
    phrase(s, 16, B, MAJ('D'), rc, 74, 'synth', seed=9, gain=0.5)
    phrase(s, 24, C, MAJ('D'), rc, 78, 'glead', seed=19, gain=0.65)
    phrase(s, 24, C, MAJ('D'), rc, 78, 'brass', seed=19, gain=0.35, shift=-12, octave_lock=(62, 88))
    return s.render(0.2, 1.6)


def camp():
    """合宿：真夏の海辺の、熱く明るいサマーロック"""
    s = Song(150, 32)
    A = ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C']
    B = ['Bb', 'C', 'Am', 'Dm', 'Bb', 'C', 'F', 'C']
    prog = A + A + B + A
    rock_drums(s, 32, '8beat', 0.65)
    rock_bass(s, prog, 32, gain=0.75)
    rock_guitar(s, prog, 16, 0, 'push', 0.33)
    rock_guitar(s, prog, 8, 16, 'mute', 0.32)
    rock_guitar(s, prog, 8, 24, 'open', 0.34)
    for bar in range(32):
        s.hit('shaker', bar * 4 + 0.5, 0.8, 0.4, 0.4, seed=bar)
        s.hit('shaker', bar * 4 + 2.5, 0.8, 0.4, 0.4, seed=bar + 99)
    ra = [[1.5, 0.5, 1, 1], [0.5, 0.5, 1, 2], [0.5, 0.5, 1, 1, 1], [4]] * 2
    rb = [[1, 1, 1.5, 0.5], [3, 1], [1, 0.5, 0.5, 2], [4]] * 2
    phrase(s, 0, A, MAJ('F'), ra, 72, 'synth', seed=21, gain=0.55)
    phrase(s, 8, A, MAJ('F'), ra, 72, 'synth', seed=21, gain=0.55)
    phrase(s, 16, B, MAJ('F'), rb, 72, 'glead', seed=23, gain=0.55)
    phrase(s, 24, A, MAJ('F'), ra, 72, 'glead', seed=21, gain=0.55)
    phrase(s, 24, A, MAJ('F'), ra, 72, 'marimba', seed=21, gain=0.35, shift=12, octave_lock=(60, 84))
    return s.render(0.15, 1.2)


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
