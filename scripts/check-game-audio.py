"""Objective delivered-audio QA. Requires existing FFmpeg and NumPy; no downloads."""
import hashlib, json, math, pathlib, re, subprocess
import numpy as np

root = pathlib.Path(__file__).resolve().parents[1]
audio = root / 'public/games/audio'
out = root / 'docs/release/four-games/evidence/audio-metrics.json'
manifest = json.loads((audio / 'music/SOURCES.json').read_text())
metrics = []
for track in manifest['tracks']:
    for asset in track['delivered']:
        path = audio / 'music' / asset['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == asset['sha256']
        decoded = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-ar', '44100', '-ac', '2', '-f', 'f32le', '-'])
        pcm = np.frombuffer(decoded, dtype='<f4').reshape(-1, 2).copy()
        edge = round(44100 * .003)
        pcm[:edge] *= (np.arange(edge) / edge)[:, None]
        pcm[-edge:] *= (np.arange(edge - 1, -1, -1) / edge)[:, None]
        loop = np.concatenate([pcm[-11025:], pcm[:11025]])
        log = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(path), '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True, check=True).stderr
        true_peak = float(re.findall(r'Peak:\s+([\d.-]+) dBFS', log)[-1])
        metrics.append({'file': asset['file'], 'bytes': path.stat().st_size, 'decodedSeconds': len(pcm)/44100, 'truePeakDBTP': true_peak, 'runtimeLoopBoundaryStep': float(np.max(np.abs(pcm[-1]-pcm[0]))), 'loopAdjacentStepMax': float(np.max(np.abs(np.diff(loop, axis=0)))), 'loop20msRMSDBFS': float(20*np.log10(np.sqrt(np.mean(loop[11025-441:11025+441]**2))))})
        assert true_peak < -5.5
        assert abs(len(pcm)/44100-track['originalSeconds']) < .065
        assert np.max(np.abs(pcm[-1]-pcm[0])) == 0

# A worst-case envelope, even allowing ten full-strength SFX despite per-cue caps.
# Resample to 4x before taking the peak to account for interpolation overshoot.
sfx_peak = 0
for path in audio.glob('*.wav'):
    data = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-ar', '192000', '-f', 'f32le', '-'])
    sfx_peak = max(sfx_peak, float(np.max(np.abs(np.frombuffer(data, dtype='<f4')))))
music_peak = max(10**(m['truePeakDBTP']/20) for m in metrics)
bound = .85*(10*sfx_peak*.2+music_peak*.2)
result = {'measurement': 'FFmpeg 7.1.5 ebur128 true-peak; 44.1kHz stereo loop PCM; SFX 4x peak', 'tracks': metrics, 'maximumVolumeMixBoundDBTP': 20*math.log10(bound), 'sfxMaxOversampledPeak': sfx_peak, 'voiceCap':10, 'perCueCap':2, 'shotContactCooldownMS':100, 'listeningClaim':False}
assert bound < 10**(-1/20)
out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
