/**
 * 浏览器端音轨提取（audioExtractor）
 *
 * 为什么需要：口播转写只需要音轨，但平台视频动辄几十 MB，
 * 上传整段视频既慢又容易撞上服务端 25MB / 100MB 限制。
 * 这里在浏览器里解码视频、下混为单声道、重采样到 16kHz 并输出 16bit WAV，
 * 体积约 1.9MB/分钟（Whisper 内部同样是 16kHz 单声道，因此不损失识别精度）。
 *
 * 任何失败（编码不支持、内存不足、无 AudioContext）都返回 null，
 * 由调用方退回上传原始文件，绝不阻断主流程。
 */

/** 低于该体积不值得解码（解码本身也有耗时） */
export const EXTRACT_MIN_BYTES = 8 * 1024 * 1024;

/** Whisper 使用的采样率 */
export const TARGET_SAMPLE_RATE = 16000;

/** 生成 16bit PCM 单声道 WAV 字节（纯函数，便于单测） */
export function wavBytes(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt 块长度
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 单声道
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // 字节率
  view.setUint16(32, 2, true); // 块对齐
  view.setUint16(34, 16, true); // 位深
  writeAscii(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

/** 多声道下混为单声道（按算术平均，避免削波） */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const length = channels[0]?.length ?? 0;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (let c = 0; c < channels.length; c += 1) sum += channels[c][i] ?? 0;
    out[i] = sum / channels.length;
  }
  return out;
}

/** 线性插值重采样（语音场景足够，不需要高阶滤波） */
export function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) return input;
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, input.length - 1);
    const weight = pos - left;
    out[i] = input[left] * (1 - weight) + input[right] * weight;
  }
  return out;
}

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * 从视频/音频中提取 16kHz 单声道 WAV。
 * @returns 成功返回 WAV File；环境不支持或解码失败返回 null（调用方应上传原文件）
 */
export async function extractAudioWav(
  input: Blob,
  opts: { fileName?: string; minBytes?: number; maxSeconds?: number } = {},
): Promise<File | null> {
  const minBytes = opts.minBytes ?? EXTRACT_MIN_BYTES;
  if (input.size < minBytes) return null;
  const Ctor = audioContextCtor();
  if (!Ctor) return null;

  let ctx: AudioContext | null = null;
  try {
    const buffer = await input.arrayBuffer();
    ctx = new Ctor();
    const decoded = await ctx.decodeAudioData(buffer);
    const maxSeconds = opts.maxSeconds ?? 3600;
    const seconds = Math.min(decoded.duration, maxSeconds);

    const channels: Float32Array[] = [];
    for (let c = 0; c < decoded.numberOfChannels; c += 1) {
      channels.push(decoded.getChannelData(c).subarray(0, Math.floor(seconds * decoded.sampleRate)));
    }
    if (!channels.length) return null;

    const mono = downmixToMono(channels);
    const resampled = resampleLinear(mono, decoded.sampleRate, TARGET_SAMPLE_RATE);
    const bytes = wavBytes(resampled, TARGET_SAMPLE_RATE);
    const baseName = (opts.fileName ?? 'audio').replace(/\.[a-zA-Z0-9]{2,5}$/, '');
    return new File([bytes as unknown as BlobPart], `${baseName}.wav`, { type: 'audio/wav' });
  } catch {
    return null;
  } finally {
    try {
      await ctx?.close();
    } catch {
      /* ignore */
    }
  }
}
