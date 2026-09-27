"""Generate original, repeatable V1 game audio. Does not modify image assets."""
from pathlib import Path
import json
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'audio'
RATE = 22050
RNG = np.random.default_rng(20260926)
records = []

def save(folder, name, signal, loop=False):
    path = OUT / folder / (name + '.wav')
    path.parent.mkdir(parents=True, exist_ok=True)
    peak = max(float(np.max(np.abs(signal))), .001)
    pcm = np.int16(np.clip(signal / peak * .72, -1, 1) * 32767)
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(pcm.tobytes())
    records.append(dict(id=name, path=path.relative_to(ROOT).as_posix(),
                        seconds=round(len(signal)/RATE, 3), sample_rate=RATE,
                        channels=1, loop=loop, source='original procedural synthesis'))

def freq(midi):
    return 440 * 2 ** ((midi - 69) / 12)

def bell(midi, seconds=.8):
    t = np.arange(int(RATE * seconds))/RATE
    f = freq(midi)
    attack = np.minimum(t/.008, 1)
    signal = (np.sin(2*np.pi*f*t)*np.exp(-t*4)
              + .25*np.sin(2*np.pi*f*2*t)*np.exp(-t*7)
              + .09*np.sin(2*np.pi*f*3*t)*np.exp(-t*10))
    return signal * attack * np.minimum((seconds-t)/.04, 1)

beat = 60/92
duration = 32*beat
loop = np.zeros(round(duration*RATE))

def mix_loop(signal, start, gain):
    indices = (np.arange(len(signal)) + round(start*RATE)) % len(loop)
    np.add.at(loop, indices, signal*gain)

# Eight original bars in a major pentatonic palette, with sparse bell melody.
melody = [[72,76,79,81], [79,76,74,None], [72,74,76,79], [76,None,74,None],
          [79,81,84,81], [79,76,74,None], [76,79,74,76], [74,None,72,None]]
basses = [48,55,53,48,57,55,53,55]
for bar, notes in enumerate(melody):
    for b, note in enumerate(notes):
        if note is not None:
            mix_loop(bell(note, 1.25), (bar*4+b)*beat, .28 if b%2 else .34)
    for b in [0,2]:
        mix_loop(bell(basses[bar], 1.5), (bar*4+b)*beat, .22)
    mix_loop(bell(basses[bar]+19, 1.0), (bar*4+1.5)*beat, .09)
save('music', 'bgm_tiangong_loop', loop, True)

t = np.arange(int(.28*RATE))/RATE
phase = 2*np.pi*(380*t+650*t*t)
rise = np.sin(phase)*np.sin(np.pi*t/.28)**2*np.exp(-t*5)
save('sfx', 'sfx_lift', rise)
score = np.zeros(int(.7*RATE))
for start, note in [(0,79),(.11,84)]:
    sig=bell(note,.5)
    i=round(start*RATE)
    score[i:i+len(sig)] += sig
save('sfx','sfx_score',score)
t=np.arange(int(.3*RATE))/RATE
hit=(np.sin(2*np.pi*(180*t-150*t*t))+.15*RNG.normal(size=len(t)))
hit *= np.minimum(t/.004,1)*np.exp(-t*18)*np.minimum((.3-t)/.03,1)
save('sfx','sfx_hit',hit)
save('sfx','sfx_ui_click',bell(86,.16))
OUT.mkdir(parents=True,exist_ok=True)
(ROOT/'audio_manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(records,ensure_ascii=False,indent=2))
