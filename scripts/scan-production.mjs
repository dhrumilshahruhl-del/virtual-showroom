import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const files = [];
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) await walk(full);
    else files.push(full);
  }
}
await walk(root);
const names = files.map(file => path.relative(root, file).replaceAll(path.sep, '/'));
const forbidden = names.filter(name => /(^|\/)(docs|scripts|node_modules|\.git)(\/|$)|\.map$/i.test(name));
const source = [];
const metadata = [];
const preservedNotices = [];
const secret = /(?:api[_-]?key|password|client[_-]?secret|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9_./+-]{12,}/i;
const local = /(?:https?:\/\/(?:localhost|127\.0\.0\.1)|(?:C|D):\\Users\\|\\Users\\[^\\]+\\|localhost:4173|localhost:9224)/i;
for (const file of files) {
  const relative = path.relative(root, file).replaceAll(path.sep, '/');
  const ext = path.extname(file).toLowerCase();
  const data = await readFile(file);
  if (['.html', '.js', '.css', '.txt', '.json', '.gltf'].includes(ext)) {
    const text = data.toString('utf8');
    if (secret.test(text)) source.push({ file: relative, type: 'secret-like value' });
    if (local.test(text)) source.push({ file: relative, type: 'localhost or user path reference' });
    if (/@[A-Z0-9._%+-]+\.[A-Z]{2,}/i.test(text)) {
      if (relative.endsWith('/meshopt_decoder.module.js') && text.includes('arseny.kapoulkine@gmail.com')) {
        preservedNotices.push({ file: relative, reason: 'Upstream MeshoptDecoder copyright attribution; retained as legitimate third-party notice.' });
      } else source.push({ file: relative, type: 'email-like string' });
    }
  }
  if (ext === '.png') {
    let offset = 8;
    const chunks = [];
    while (offset + 12 <= data.length) {
      const length = data.readUInt32BE(offset);
      const type = data.toString('ascii', offset + 4, offset + 8);
      if (['tEXt', 'zTXt', 'iTXt', 'eXIf'].includes(type)) chunks.push(type);
      offset += length + 12;
      if (type === 'IEND') break;
    }
    if (chunks.length) metadata.push({ file: relative, chunks });
  } else if (ext === '.webp') {
    const chunks = [];
    let offset = 12;
    while (offset + 8 <= data.length) {
      const type = data.toString('ascii', offset, offset + 4);
      const size = data.readUInt32LE(offset + 4);
      if (['EXIF', 'XMP ', 'ICCP', 'META'].includes(type)) chunks.push(type.trim());
      offset += 8 + size + (size & 1);
    }
    if (chunks.length) metadata.push({ file: relative, chunks });
  } else if (ext === '.hdr') {
    metadata.push({ file: relative, header: data.subarray(0, 160).toString('ascii').split('\n').slice(0, 3) });
  } else if (ext === '.glb') {
    let offset = 12;
    while (offset + 8 <= data.length) {
      const length = data.readUInt32LE(offset);
      const type = data.readUInt32LE(offset + 4);
      if (type === 0x4e4f534a) {
        const json = JSON.parse(data.subarray(offset + 8, offset + 8 + length).toString('utf8').trim());
        const encoded = JSON.stringify(json);
        const fields = ['author', 'copyright', 'license', 'source', 'generator', 'extras'].filter(key => key in (json.asset || {}) || key in json);
        metadata.push({ file: relative, generator: json.asset?.generator || null, fields, filesystemPathLike: /(?:[A-Z]:\\|\\Users\\|\/Users\/)/.test(encoded) });
        break;
      }
      offset += 8 + length;
    }
  } else if (ext === '.gltf') {
    const json = JSON.parse(data.toString('utf8'));
    metadata.push({ file: relative, generator: json.asset?.generator || null,
      authorshipOrCopyrightFields: ['author', 'copyright', 'license', 'source', 'extras'].filter(key => key in (json.asset || {}) || key in json),
      uriValues: (json.buffers || []).map(buffer => buffer.uri).filter(Boolean) });
  }
}
const result = { fileCount: names.length, forbiddenPaths: forbidden, sourceFindings: source,
  preservedThirdPartyNotices: preservedNotices, metadataFindings: metadata };
console.log(JSON.stringify(result, null, 2));
if (forbidden.length || source.some(finding => finding.type === 'secret-like value')) process.exitCode = 1;
