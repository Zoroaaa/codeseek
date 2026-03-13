interface ParsedMagnet {
  infoHash: string;
  name: string;
  trackers: string[];
  dn: string;
}

export function parseMagnet(magnetUri: string): ParsedMagnet | null {
  if (!magnetUri.startsWith('magnet:')) return null;

  const url = new URL(magnetUri);
  const params = new URLSearchParams(url.search.slice(1));

  const xt = params.get('xt') || '';
  const infoHashMatch = xt.match(/urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/);
  if (!infoHashMatch) return null;

  let infoHash = infoHashMatch[1];
  if (infoHash.length === 32) {
    infoHash = base32ToHex(infoHash);
  }

  return {
    infoHash: infoHash.toLowerCase(),
    name: params.get('dn') || '',
    dn: params.get('dn') || '',
    trackers: params.getAll('tr'),
  };
}

function base32ToHex(base32: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of base32.toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  let hex = '';
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    hex += parseInt(bits.slice(i, i + 8), 2).toString(16).padStart(2, '0');
  }
  return hex;
}

export async function generateTorrentFile(
  magnetUri: string,
  options: { announce?: string; comment?: string } = {}
): Promise<Blob | null> {
  const parsed = parseMagnet(magnetUri);
  if (!parsed) return null;

  const trackers = options.announce
    ? [options.announce, ...parsed.trackers]
    : parsed.trackers;

  const torrent: Record<string, unknown> = {
    info: {
      name: parsed.name || parsed.infoHash.toUpperCase(),
      'piece length': 16384,
      pieces: '',
    },
  };

  if (trackers.length > 0) {
    if (trackers.length === 1) {
      torrent.announce = trackers[0];
    } else {
      torrent['announce-list'] = trackers.map((t) => [t]);
    }
  }

  if (options.comment) {
    torrent.comment = options.comment;
  }

  torrent['creation date'] = Math.floor(Date.now() / 1000);
  torrent['created by'] = 'CodeSeek v2.0';

  const encoded = bencodeEncode(torrent);
  const buffer = new ArrayBuffer(encoded.length);
  new Uint8Array(buffer).set(encoded);
  return new Blob([buffer], { type: 'application/x-bittorrent' });
}

function bencodeEncode(data: unknown): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  function encode(val: unknown): void {
    if (typeof val === 'string') {
      const bytes = encoder.encode(val);
      chunks.push(encoder.encode(bytes.length + ':'));
      chunks.push(bytes);
    } else if (typeof val === 'number') {
      chunks.push(encoder.encode('i' + val + 'e'));
    } else if (Array.isArray(val)) {
      chunks.push(encoder.encode('l'));
      for (const item of val) encode(item);
      chunks.push(encoder.encode('e'));
    } else if (val instanceof Uint8Array) {
      chunks.push(encoder.encode(val.length + ':'));
      chunks.push(val);
    } else if (typeof val === 'object' && val !== null) {
      chunks.push(encoder.encode('d'));
      const keys = Object.keys(val).sort();
      for (const key of keys) {
        encode(key);
        encode((val as Record<string, unknown>)[key]);
      }
      chunks.push(encoder.encode('e'));
    }
  }

  encode(data);

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function downloadTorrentFile(magnetUri: string, filename?: string): boolean {
  const parsed = parseMagnet(magnetUri);
  if (!parsed) return false;

  generateTorrentFile(magnetUri).then((blob) => {
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (filename || parsed.name || parsed.infoHash) + '.torrent';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  return true;
}

export function openMagnetClient(magnetUri: string): void {
  window.location.href = magnetUri;
}

export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard
    .writeText(text)
    .then(() => true)
    .catch(() => false);
}

export function getWebtorUrl(magnetUri: string): string {
  const parsed = parseMagnet(magnetUri);
  if (!parsed) return '';

  return `https://webtor.io/show#${encodeURIComponent(magnetUri)}`;
}

export function getBtorrentUrl(magnetUri: string): string {
  return `https://btorrent.xyz/#${encodeURIComponent(magnetUri)}`;
}

export function getMagnetShortHash(magnetUri: string): string {
  const parsed = parseMagnet(magnetUri);
  return parsed ? parsed.infoHash.substring(0, 8).toUpperCase() : 'UNKNOWN';
}
