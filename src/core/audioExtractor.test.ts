import { describe, expect, it } from 'vitest';
import { downmixToMono, extractAudioWav, resampleLinear, wavBytes } from './audioExtractor';

describe('audioExtractor', () => {
  it('wavBytes 生成合法的 16bit 单声道 WAV 头', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1]);
    const bytes = wavBytes(samples, 16000);
    expect(bytes.length).toBe(44 + samples.length * 2);

    const ascii = (start: number, len: number) => String.fromCharCode(...bytes.slice(start, start + len));
    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    expect(ascii(12, 4)).toBe('fmt ');
    expect(ascii(36, 4)).toBe('data');

    const view = new DataView(bytes.buffer);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // 单声道
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16); // 位深
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
  });

  it('wavBytes 会把采样值限幅，避免整数溢出', () => {
    const bytes = wavBytes(new Float32Array([2, -2]), 16000);
    const view = new DataView(bytes.buffer);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });

  it('downmixToMono 为多声道取平均', () => {
    const mono = downmixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])]);
    expect(Array.from(mono)).toEqual([0.5, 0.5]);
  });

  it('resampleLinear 按比例缩短长度', () => {
    const input = new Float32Array(44100).fill(0.25);
    const out = resampleLinear(input, 44100, 16000);
    expect(out.length).toBe(16000);
    expect(out[0]).toBeCloseTo(0.25, 5);
  });

  it('小文件不提取音轨（返回 null，交由调用方上传原文件）', async () => {
    const small = new File([new Uint8Array(1024)], 'a.mp4', { type: 'video/mp4' });
    await expect(extractAudioWav(small)).resolves.toBeNull();
  });

  it('环境无 AudioContext 时安全返回 null', async () => {
    const big = new File([new Uint8Array(9 * 1024 * 1024)], 'b.mp4', { type: 'video/mp4' });
    await expect(extractAudioWav(big)).resolves.toBeNull();
  });
});
