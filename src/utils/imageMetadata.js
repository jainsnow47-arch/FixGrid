const HINT_STOP_WORDS = new Set([
  'img', 'image', 'photo', 'pic', 'picture', 'vid', 'video', 'dsc', 'pxl',
  'screenshot', 'whatsapp', 'camera', 'file', 'upload', 'media', 'copy',
]);

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRecencyLabel(timestampMs) {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return 'Unknown capture time';
  const diffMs = Date.now() - timestampMs;
  if (diffMs < 0) return 'Recent capture';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 5) return 'Captured just now';
  if (mins < 60) return `Captured ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Captured ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'Captured yesterday' : `Captured ${days} days ago`;
}

function extractFilenameHints(fileName = '') {
  const base = fileName.replace(/\.[^.]+$/, '').toLowerCase();
  const tokens = base
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !HINT_STOP_WORDS.has(t));
  return Array.from(new Set(tokens)).slice(0, 8);
}

function readAscii(view, offset, length) {
  let out = '';
  const end = Math.min(view.byteLength, offset + length);
  for (let i = offset; i < end; i += 1) {
    const code = view.getUint8(i);
    if (code === 0) break;
    if (code >= 32 && code <= 126) out += String.fromCharCode(code);
  }
  return out.trim();
}

function readRational(view, offset, littleEndian) {
  if (offset + 8 > view.byteLength) return null;
  const num = view.getUint32(offset, littleEndian);
  const den = view.getUint32(offset + 4, littleEndian);
  if (!den) return null;
  return num / den;
}

function readExifValue(view, tiffStart, entryOffset, littleEndian) {
  const type = view.getUint16(entryOffset + 2, littleEndian);
  const count = view.getUint32(entryOffset + 4, littleEndian);
  const valueOffsetField = entryOffset + 8;

  const typeSizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const unitSize = typeSizes[type] || 1;
  const totalBytes = unitSize * count;
  const dataOffset = totalBytes <= 4
    ? valueOffsetField
    : tiffStart + view.getUint32(valueOffsetField, littleEndian);

  if (dataOffset < 0 || dataOffset >= view.byteLength) return null;

  if (type === 2) {
    return readAscii(view, dataOffset, count);
  }
  if (type === 3 && count === 1) {
    return view.getUint16(dataOffset, littleEndian);
  }
  if (type === 4 && count === 1) {
    return view.getUint32(dataOffset, littleEndian);
  }
  if (type === 5) {
    const vals = [];
    for (let i = 0; i < count; i += 1) {
      const r = readRational(view, dataOffset + i * 8, littleEndian);
      if (r === null) return null;
      vals.push(r);
    }
    return count === 1 ? vals[0] : vals;
  }
  return null;
}

function dmsToDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const dec = dms[0] + dms[1] / 60 + dms[2] / 3600;
  if (!Number.isFinite(dec)) return null;
  const sign = ref === 'S' || ref === 'W' ? -1 : 1;
  return Number((dec * sign).toFixed(6));
}

function parseExifDateString(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function extractJpegExif(file) {
  try {
    const slice = file.slice(0, 131072);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);

    if (view.byteLength < 12 || view.getUint16(0, false) !== 0xffd8) {
      return {};
    }

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xffe1) {
        const segmentLength = view.getUint16(offset, false);
        if (offset + 8 > view.byteLength) break;
        const header = readAscii(view, offset + 2, 4);
        if (header !== 'Exif') {
          offset += segmentLength;
          continue;
        }

        const tiffStart = offset + 8;
        if (tiffStart + 8 > view.byteLength) break;
        const endianMark = view.getUint16(tiffStart, false);
        const littleEndian = endianMark === 0x4949;
        const ifd0Rel = view.getUint32(tiffStart + 4, littleEndian);
        const ifd0Offset = tiffStart + ifd0Rel;

        const result = {};
        let exifIfdOffset = null;
        let gpsIfdOffset = null;

        if (ifd0Offset + 2 <= view.byteLength) {
          const entries = view.getUint16(ifd0Offset, littleEndian);
          for (let i = 0; i < entries; i += 1) {
            const entry = ifd0Offset + 2 + i * 12;
            if (entry + 12 > view.byteLength) break;
            const tag = view.getUint16(entry, littleEndian);
            if (tag === 0x010f) result.cameraMake = readExifValue(view, tiffStart, entry, littleEndian);
            if (tag === 0x0110) result.cameraModel = readExifValue(view, tiffStart, entry, littleEndian);
            if (tag === 0x8769) {
              const rel = readExifValue(view, tiffStart, entry, littleEndian);
              if (typeof rel === 'number') exifIfdOffset = tiffStart + rel;
            }
            if (tag === 0x8825) {
              const rel = readExifValue(view, tiffStart, entry, littleEndian);
              if (typeof rel === 'number') gpsIfdOffset = tiffStart + rel;
            }
          }
        }

        if (exifIfdOffset && exifIfdOffset + 2 <= view.byteLength) {
          const entries = view.getUint16(exifIfdOffset, littleEndian);
          for (let i = 0; i < entries; i += 1) {
            const entry = exifIfdOffset + 2 + i * 12;
            if (entry + 12 > view.byteLength) break;
            const tag = view.getUint16(entry, littleEndian);
            if (tag === 0x9003 || tag === 0x9004) {
              const rawDate = readExifValue(view, tiffStart, entry, littleEndian);
              const parsed = parseExifDateString(rawDate);
              if (parsed && !result.exifCapturedAt) result.exifCapturedAt = parsed;
            }
          }
        }

        if (gpsIfdOffset && gpsIfdOffset + 2 <= view.byteLength) {
          const entries = view.getUint16(gpsIfdOffset, littleEndian);
          let latRef = 'N';
          let lngRef = 'E';
          let latDms = null;
          let lngDms = null;

          for (let i = 0; i < entries; i += 1) {
            const entry = gpsIfdOffset + 2 + i * 12;
            if (entry + 12 > view.byteLength) break;
            const tag = view.getUint16(entry, littleEndian);
            if (tag === 0x0001) latRef = readExifValue(view, tiffStart, entry, littleEndian) || 'N';
            if (tag === 0x0002) latDms = readExifValue(view, tiffStart, entry, littleEndian);
            if (tag === 0x0003) lngRef = readExifValue(view, tiffStart, entry, littleEndian) || 'E';
            if (tag === 0x0004) lngDms = readExifValue(view, tiffStart, entry, littleEndian);
          }

          const lat = dmsToDecimal(latDms, latRef);
          const lng = dmsToDecimal(lngDms, lngRef);
          if (
            lat !== null &&
            lng !== null &&
            Math.abs(lat) <= 90 &&
            Math.abs(lng) <= 180 &&
            (lat !== 0 || lng !== 0)
          ) {
            result.exifGps = { lat, lng };
          }
        }

        return result;
      }

      if ((marker & 0xff00) !== 0xff00) break;
      if (offset + 2 > view.byteLength) break;
      const len = view.getUint16(offset, false);
      if (len < 2) break;
      offset += len;
    }
  } catch {
    return {};
  }
  return {};
}

function readImageDimensions(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || 0;
      const height = img.naturalHeight || 0;
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: 0, height: 0 });
    };
    img.src = objectUrl;
  });
}

function readVideoMetadata(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      const durationSeconds = Number.isFinite(video.duration) ? Math.round(video.duration) : 0;
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height, durationSeconds });
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: 0, height: 0, durationSeconds: 0 });
    };
    video.src = objectUrl;
  });
}

export async function extractMediaMetadata(file) {
  if (!file) return null;

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const filenameHints = extractFilenameHints(file.name);
  const modifiedMs = file.lastModified || Date.now();

  let dims = { width: 0, height: 0 };
  let durationSeconds = 0;
  let exif = {};

  if (isImage) {
    const [imgDims, jpegExif] = await Promise.all([
      readImageDimensions(file),
      file.type === 'image/jpeg' ? extractJpegExif(file) : Promise.resolve({}),
    ]);
    dims = imgDims;
    exif = jpegExif || {};
  } else if (isVideo) {
    const vMeta = await readVideoMetadata(file);
    dims = { width: vMeta.width, height: vMeta.height };
    durationSeconds = vMeta.durationSeconds;
  }

  const width = dims.width || 0;
  const height = dims.height || 0;
  const orientation =
    width && height
      ? width > height
        ? 'Landscape'
        : height > width
          ? 'Portrait'
          : 'Square'
      : 'Unknown';
  const megapixels = width && height ? Number(((width * height) / 1_000_000).toFixed(1)) : null;

  const capturedAt = exif.exifCapturedAt || new Date(modifiedMs).toISOString();
  const capturedMs = new Date(capturedAt).getTime();
  const cameraLabel = [exif.cameraMake, exif.cameraModel]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    fileName: file.name,
    mimeType: file.type,
    mediaKind: isImage ? 'image' : isVideo ? 'video' : 'file',
    sizeBytes: file.size,
    sizeLabel: formatFileSize(file.size),
    width,
    height,
    resolutionLabel: width && height ? `${width}×${height}` : null,
    megapixels,
    orientation,
    durationSeconds: durationSeconds || null,
    capturedAt,
    recencyLabel: formatRecencyLabel(Number.isFinite(capturedMs) ? capturedMs : modifiedMs),
    cameraLabel: cameraLabel || null,
    hasExifGps: Boolean(exif.exifGps),
    exifGps: exif.exifGps || null,
    filenameHints,
  };
}
