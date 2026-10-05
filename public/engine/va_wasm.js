/* @ts-self-types="./va_wasm.d.ts" */

/**
 * Analyze audio: silence, content type, structure.
 *
 * Input: PCM samples (mono f32) + sample_rate.
 * Returns: JSON `{ duration, content_type, regions, sections, leading_silence, trailing_silence, spectral_flatness }`
 * @param {Float32Array} samples
 * @param {number} sample_rate
 * @param {string | null} [config_json]
 * @returns {string}
 */
export function analyze_audio(samples, sample_rate, config_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passArrayF32ToWasm0(samples, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(config_json) ? 0 : passStringToWasm0(config_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.analyze_audio(ptr0, len0, sample_rate, ptr1, len1);
        deferred3_0 = ret[0];
        deferred3_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Build a montage timeline from scored segments and configuration.
 *
 * Unified CRF-based entry point. Profile defaults to quality-only.
 *
 * Input: JSON `{ segments: [SegmentScore], beats?: [f64], config?: BeatSyncConfig, profile?: string, target_duration?: f64 }`
 * - `profile`: `"film"` | `"music-video"` | `"transcript"` | `"travel"` | `"family"` | `"documentary"` (default: quality-only)
 * - `target_duration`: target output length in seconds (default: 0 = unlimited)
 * Returns: Timeline JSON `{ shots: [...], total_duration, mode }`
 *
 * JS usage:
 * ```js
 * const segments = analysisResult.segments.map(s => ({
 *     start: s.start,
 *     end: s.end,
 *     segment_id: s.segment_id,
 *     source_id: s.source_id ?? 0,
 *     score: s.score,
 *     is_garbage: s.is_garbage,
 *     best_frame_ts: s.best_frame_ts,
 * }));
 * const json = wasm.beat_sync_timeline(JSON.stringify({
 *     segments,
 *     beats: beatTimestamps,  // optional: empty = film mode
 *     profile: "film",
 *     target_duration: 60.0,
 * }));
 * ```
 * @param {string} input_json
 * @returns {string}
 */
export function beat_sync_timeline(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.beat_sync_timeline(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Build OTIO JSON from analysis results.
 *
 * Input: JSON matching OtioInput structure.
 * @param {string} input_json
 * @returns {string}
 */
export function build_otio(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.build_otio(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Compute cache fingerprint from file head bytes + total file size.
 *
 * JS usage (File API → WASM → IndexedDB key):
 * ```js
 * const file = inputElement.files[0];
 * const head = await file.slice(0, 65536).arrayBuffer();
 * const fingerprint = wasm.cache_fingerprint(new Uint8Array(head), BigInt(file.size));
 * ```
 * @param {Uint8Array} head_bytes
 * @param {bigint} file_size
 * @returns {string}
 */
export function cache_fingerprint(head_bytes, file_size) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passArray8ToWasm0(head_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.cache_fingerprint(ptr0, len0, file_size);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Inject fingerprint into OTIO JSON for caching. Returns enriched JSON.
 *
 * JS usage:
 * ```js
 * const otio = wasm.build_otio(input);
 * const cached = wasm.cache_prepare(otio, fingerprint);
 * localStorage.setItem(`va-cache:${fingerprint}`, cached);
 * ```
 * @param {string} otio_json
 * @param {string} fingerprint
 * @returns {string}
 */
export function cache_prepare(otio_json, fingerprint) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(otio_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(fingerprint, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.cache_prepare(ptr0, len0, ptr1, len1);
        deferred3_0 = ret[0];
        deferred3_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Check if OTIO JSON has a matching fingerprint. Returns `true` if valid.
 *
 * JS usage:
 * ```js
 * const cached = localStorage.getItem(`va-cache:${fingerprint}`);
 * if (cached && wasm.cache_validate(cached, fingerprint)) { ... }
 * ```
 * @param {string} otio_json
 * @param {string} fingerprint
 * @returns {boolean}
 */
export function cache_validate(otio_json, fingerprint) {
    const ptr0 = passStringToWasm0(otio_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(fingerprint, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.cache_validate(ptr0, len0, ptr1, len1);
    return ret !== 0;
}

/**
 * Compose a montage Timeline (from va-director) into OTIO JSON.
 *
 * Input: JSON `{ timeline: Timeline, media: { path, duration_secs, fps } }`
 * Returns: OTIO JSON string.
 *
 * JS usage:
 * ```js
 * const timelineJson = wasm.beat_sync_timeline(input);
 * const timeline = JSON.parse(timelineJson);
 * const otio = wasm.compose_montage(JSON.stringify({
 *     timeline,
 *     media: { path: "video.mp4", duration_secs: 120.0, fps: 30.0 }
 * }));
 * ```
 * @param {string} input_json
 * @returns {string}
 */
export function compose_montage(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.compose_montage(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Detect beats in PCM audio samples (mono f32, any sample rate).
 *
 * Input: JSON `{ samples: Float32Array (base64 or array), sample_rate: u32, config?: { min_bpm?, max_bpm?, tightness?, trim? } }`
 * Returns: JSON `{ beats: [f64], bpm: f64 }`
 *
 * JS usage (Web Audio API decode → Float32Array → WASM):
 * ```js
 * const audioCtx = new AudioContext({ sampleRate: 22050 });
 * const resp = await fetch(audioUrl);
 * const buf = await audioCtx.decodeAudioData(await resp.arrayBuffer());
 * const mono = buf.getChannelData(0); // Float32Array
 * const json = wasm.detect_beats(mono, 22050);
 * ```
 * @param {Float32Array} samples
 * @param {number} sample_rate
 * @param {string | null} [config_json]
 * @returns {string}
 */
export function detect_beats(samples, sample_rate, config_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passArrayF32ToWasm0(samples, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(config_json) ? 0 : passStringToWasm0(config_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.detect_beats(ptr0, len0, sample_rate, ptr1, len1);
        deferred3_0 = ret[0];
        deferred3_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Detect scene boundaries from content deltas (HSV frame-to-frame differences).
 *
 * Input: JSON `{ deltas: [{ timestamp, delta_hue, delta_sat, delta_lum }], duration, threshold?, method? }`
 * method: "content" (default) or "adaptive"
 * @param {string} input_json
 * @returns {string}
 */
export function detect_scenes_content(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.detect_scenes_content(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Detect scene boundaries from N-dim feature vectors (L2 or cosine distance).
 *
 * Input: JSON `{ features: [[f32; N]], timestamps: [f64], duration, method?, threshold_k?, min_gap? }`
 * method: "feature_l2" (default) or "feature_cosine"
 * @param {string} input_json
 * @returns {string}
 */
export function detect_scenes_features(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.detect_scenes_features(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Detect scene boundaries from center pixel diffs (slick algorithms).
 *
 * Input: JSON `{ pixels: [{ r, g, b }], timestamps: [f64], duration, algo?, config? }`
 * @param {string} input_json
 * @returns {string}
 */
export function detect_scenes_slick(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.detect_scenes_slick(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Get all feature names in canonical order.
 * @returns {string}
 */
export function feature_names() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.feature_names();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Get scoring weights for a genre. Returns JSON `{ weights: { name: value }, bias }`.
 * @param {string} genre
 * @returns {string}
 */
export function get_weights(genre) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(genre, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.get_weights(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Parse OTIO JSON back to analysis data.
 * @param {string} otio_json
 * @returns {string}
 */
export function parse_otio(otio_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(otio_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.parse_otio(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Get all available scene detection algorithm names.
 * @returns {string}
 */
export function scene_algorithms() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.scene_algorithms();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Score a single RGB24 frame. Returns FrameFeatures as JSON.
 *
 * JS usage:
 * ```js
 * const ctx = canvas.getContext('2d');
 * ctx.drawImage(video, 0, 0, w, h);
 * const rgba = ctx.getImageData(0, 0, w, h).data;
 * // Convert RGBA → RGB24 (drop alpha)
 * const rgb = new Uint8Array(w * h * 3);
 * for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
 *     rgb[j] = rgba[i]; rgb[j+1] = rgba[i+1]; rgb[j+2] = rgba[i+2];
 * }
 * const json = wasm.score_frame(w, h, rgb, 1.5, "default");
 * ```
 * @param {number} w
 * @param {number} h
 * @param {Uint8Array} rgb24
 * @param {number} timestamp
 * @param {string | null} [genre]
 * @returns {string}
 */
export function score_frame(w, h, rgb24, timestamp, genre) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passArray8ToWasm0(rgb24, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(genre) ? 0 : passStringToWasm0(genre, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.score_frame(w, h, ptr0, len0, timestamp, ptr1, len1);
        deferred3_0 = ret[0];
        deferred3_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Score multiple pre-computed FrameFeatures and return segment scores.
 *
 * Input: JSON array of `{ segments: [...], features: [...], genre?: string }`
 * - segments: `[{ id, start, end }]`
 * - features: `[{ timestamp, scores: { sharpness: 0.5, ... } }]`
 * @param {string} input_json
 * @returns {string}
 */
export function score_segments(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.score_segments(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Select best segments for target duration using knapsack algorithms.
 *
 * Input: JSON `{ segments: [{ id, start, end, score, is_garbage }], target, mode? }`
 * mode: "greedy" (default), "dp", "graph"
 * @param {string} input_json
 * @returns {string}
 */
export function select_segments(input_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.select_segments(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_df03e93053e0f4bc: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./va_wasm_bg.js": import0,
    };
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('va_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
