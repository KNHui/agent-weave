import { execFile } from 'node:child_process';
import { lstat, opendir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { digest, discover, inside } from './assets.mjs';

const run = promisify(execFile);
const posix = path.posix;
const LIMITS = { files: 500, bytes: 1024 * 1024, depth: 16, diffLines: 400, previewLines: 4000 };
const skipped = new Set(['.git', 'node_modules', '.DS_Store', 'Thumbs.db']);
const markdown = new Set(['.md', '.mdc', '.markdown', '.txt']);
const scripts = new Set(['.sh', '.bash', '.zsh', '.js', '.mjs', '.cjs', '.ts', '.py', '.rb', '.ps1']);
const entryFiles = new Set(['AGENTS.md', 'CLAUDE.md']);
const defaultMappings = [
  ['.claude/skills', '.agents/skills'], ['.codex/skills', '.agents/skills'], ['.cursor/skills', '.agents/skills'],
  ['.claude/commands', '.agents/commands'], ['.cursor/rules', '.agents/rules'],
];
const markers = [
  ['package.json', 'node'], ['package-lock.json', 'npm'], ['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lock', 'bun'], ['bun.lockb', 'bun'],
  ['pyproject.toml', 'python'], ['uv.lock', 'uv'], ['poetry.lock', 'poetry'], ['requirements.txt', 'pip'],
  ['go.mod', 'go'], ['Cargo.toml', 'cargo'], ['build.gradle', 'gradle'], ['build.gradle.kts', 'gradle'], ['pom.xml', 'maven'],
];
const commands = {
  npm: ['npm', 'npx'], pnpm: ['pnpm', 'pnpx'], yarn: ['yarn'], bun: ['bun', 'bunx'], uv: ['uv', 'uvx'], poetry: ['poetry'],
  pip: ['pip'], go: ['go'], cargo: ['cargo'], gradle: ['gradle', 'gradlew'], maven: ['mvn'],
};
const agentLocations = ['.agents', '.agents/skills', '.agents/commands', '.agents/rules', '.agents/docs', '.claude/skills', '.claude/commands', '.codex', '.cursor/rules', 'docs', 'AGENTS.md', 'CLAUDE.md'];
const machinePath = /(?:^|[\s"'`(=])(?:\/Users\/|\/home\/)[\w.-]+|\b[A-Za-z]:\\Users\\[^\\\s]+/;
const secrets = [
  /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{36,}/, /\bgithub_pat_[A-Za-z0-9_]{20,}/, /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\bsk-[A-Za-z0-9_-]{20,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:api[_-]?key|secret|token|password|passwd)\b["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i,
];
const blocking = new Set([
  'missing_reference', 'outside_root', 'unsupported_file', 'too_large', 'bundle_limit', 'unsafe_destination', 'duplicate_destination',
  'destination_conflict', 'possible_secret', 'machine_path', 'adaptation_not_found', 'adaptation_ambiguous', 'entry_file',
]);

const toPosix = (value) => value.split(path.sep).join('/');
const local = (root, rel) => path.join(root, ...rel.split('/'));
const lines = (text) => { const result = text.split('\n'); if (result.at(-1) === '') result.pop(); return result; };
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const under = (rel, prefix) => rel === prefix || rel.startsWith(`${prefix}/`);
const trimSlashes = (value) => toPosix(value).replace(/^\.\/+/, '').replace(/\/+$/, '');
const stable = (value) => Array.isArray(value) ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);

async function projectRoot(value, name) {
  if (!path.isAbsolute(value)) throw new Error(`${name} must be absolute`);
  const canonical = await realpath(value).catch(() => { throw new Error(`${name} does not exist`); });
  if (!(await stat(canonical)).isDirectory()) throw new Error(`${name} must be a directory`);
  return canonical;
}

async function projects({ source_root, destination_root }) {
  const source = await projectRoot(source_root, 'source_root');
  const destination = await projectRoot(destination_root, 'destination_root');
  if (source === destination) throw new Error('source_root and destination_root must differ');
  return { source, destination };
}

// Git is queried for identity only; file hashes remain the authority for uncommitted changes.
async function git(root, args) {
  try {
    const { stdout } = await run('git', ['-C', root, ...args], { timeout: 5000, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
    return stdout.trim() || undefined;
  } catch { return undefined; }
}

export function sanitizeRemote(url) {
  const scp = url.match(/^(?:[^@/]+@)?([^:/]+):(?!\/)(.+)$/);
  let host, pathname;
  if (scp) [host, pathname] = [scp[1], scp[2]];
  else {
    try { ({ host, pathname } = new URL(url)); } catch { return undefined; }
  }
  if (!host) return undefined;
  return `${host}/${pathname.replace(/^\/+/, '').replace(/\.git$/, '')}`;
}

async function identity(root, name) {
  const revision = await git(root, ['rev-parse', '--verify', 'HEAD']);
  const prefix = revision && await git(root, ['rev-parse', '--show-prefix']);
  const remote = revision && await git(root, ['config', '--get', 'remote.origin.url']);
  return { name: name || (remote && sanitizeRemote(remote)) || path.basename(root), path: prefix?.replace(/\/$/, ''), revision };
}

async function evidence(root) {
  const exists = (rel) => lstat(local(root, rel)).then(() => true, () => false);
  const found = [];
  const tools = new Set();
  for (const [file, tool] of markers) if (await exists(file)) { found.push(file); tools.add(tool); }
  if (tools.has('node') && !['npm', 'pnpm', 'yarn', 'bun'].some((tool) => tools.has(tool))) tools.add('npm');
  let packageScripts = [];
  try { packageScripts = Object.keys(JSON.parse(await readFile(local(root, 'package.json'), 'utf8')).scripts ?? {}).sort(); } catch { /* No readable package.json. */ }
  const locations = [];
  for (const rel of agentLocations) if (await exists(rel)) locations.push(rel);
  return { markers: found, tools: [...tools].sort(), package_scripts: packageScripts, agent_locations: locations };
}

// Top-level scalars only: plain or quoted values, indented continuation lines, and `>`/`|` block scalars.
export function frontmatter(text) {
  const rows = (text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '').split(/\r?\n/);
  const field = (key) => {
    const index = rows.findIndex((row) => row.startsWith(`${key}:`));
    if (index === -1) return undefined;
    const head = rows[index].slice(key.length + 1).trim();
    const end = rows.findIndex((row, at) => at > index && row.trim() && !/^\s/.test(row));
    const body = rows.slice(index + 1, end === -1 ? undefined : end).map((row) => row.trim());
    const block = /^[>|][+-]?$/.test(head);
    const parts = block ? body : [head, ...body];
    const value = (head.startsWith('|') ? parts.join('\n') : parts.filter(Boolean).join(' ')).trim();
    return (block ? value : value.replace(/^(["'])([\s\S]*)\1$/, '$2')) || undefined;
  };
  return { name: field('name'), description: field('description'), allowedTools: field('allowed-tools') };
}

export function classify(rel) {
  const parts = rel.split('/');
  if (parts.at(-1) === 'SKILL.md') return 'skill';
  if (parts.length === 1 && entryFiles.has(parts[0])) return 'entry';
  if (parts.includes('commands')) return 'command';
  if (parts.includes('rules')) return 'rule';
  if (parts.includes('specs')) return 'spec';
  return 'doc';
}

// Apply fn to prose only; fenced blocks and inline code are not links.
const codeSpans = /(^```[\s\S]*?^```[^\n]*$|^~~~[\s\S]*?^~~~[^\n]*$|`[^`\n]+`)/gm;
const prose = (text, fn) => text.split(codeSpans).map((part, index) => index % 2 ? part : fn(part)).join('');
const linkForms = [
  /(\]\()(<[^>\n]+>|[^)\s]+)((?:\s+"[^"\n]*")?\))/g,
  /^(\s{0,3}\[[^\]\n]+\]:[ \t]*)(<[^>\n]+>|\S+)()/gm,
  /(^|\s)@((?:\.{1,2}\/)?[\w.-]+(?:\/[\w.-]+)*\.(?:md|mdc|markdown|txt|json|ya?ml|toml|sh|js|mjs|ts|py))()/g,
];

function parseTarget(raw) {
  const unwrapped = raw.startsWith('<') ? raw.slice(1, -1) : raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(unwrapped) || /^[#/~\\]/.test(unwrapped)) return undefined;
  const cut = unwrapped.search(/[?#]/);
  const target = cut === -1 ? unwrapped : unwrapped.slice(0, cut);
  if (!target) return undefined;
  let decoded = target;
  try { decoded = decodeURIComponent(target); } catch { /* Keep undecodable text. */ }
  return { target: decoded, encoded: decoded !== target, suffix: cut === -1 ? '' : unwrapped.slice(cut), wrapped: raw.startsWith('<') };
}

function mapLinks(text, fn) {
  return prose(text, (part) => linkForms.reduce((current, form) => current.replace(form, (match, before, raw, after) => {
    const parsed = parseTarget(raw);
    const replacement = parsed && fn(parsed);
    return replacement === undefined ? match : `${before}${replacement}${after}`;
  }), part));
}

function mapPath(rel, mappings) {
  const user = Object.entries(mappings).map(([from, to]) => [trimSlashes(from), trimSlashes(to)]).sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of [...user, ...defaultMappings]) {
    if (from && under(rel, from)) return posix.join(to || '.', rel.slice(from.length + 1) || '.').replace(/^\.\//, '');
  }
  return rel;
}

function selectionPath(value) {
  const rel = trimSlashes(value);
  if (!rel || posix.isAbsolute(rel) || /^[A-Za-z]:/.test(rel) || posix.normalize(rel).startsWith('..')) throw new Error(`Selection must be relative to source_root: ${value}`);
  return posix.normalize(rel);
}

async function readFileBounded(file, size) {
  if (size > LIMITS.bytes) return undefined;
  const bytes = await readFile(file);
  return bytes.length > LIMITS.bytes ? undefined : bytes;
}

function createBundle(root, exclude, { adaptations = [], destination, target = (rel) => rel } = {}) {
  const excluded = exclude.map(trimSlashes);
  const bundle = { root, destination, target, adaptations, files: new Map(), dirs: new Set(), walked: new Set(), aliases: [], excluded: new Set(), findings: [] };
  bundle.isExcluded = (rel) => excluded.some((item) => under(rel, item));
  bundle.find = (code, rel, detail) => {
    if (!bundle.findings.some((item) => item.code === code && item.path === rel)) bundle.findings.push({ code, severity: blocking.has(code) ? 'blocking' : 'advisory', path: rel, detail });
  };
  return bundle;
}

async function collect(bundle, rel, role, depth = 0) {
  if (bundle.isExcluded(rel)) { bundle.excluded.add(rel); return; }
  if (bundle.files.has(rel) || bundle.dirs.has(rel)) return;
  if (depth > LIMITS.depth) return bundle.find('bundle_limit', rel, `Depth limit ${LIMITS.depth} reached`);
  if (bundle.files.size >= LIMITS.files) return bundle.find('bundle_limit', rel, `File limit ${LIMITS.files} reached`);
  let canonical;
  try { canonical = await realpath(local(bundle.root, rel)); } catch {
    return bundle.find('missing_reference', rel, 'Referenced path does not exist; restore it or exclude it');
  }
  if (!inside(bundle.root, canonical)) return bundle.find('outside_root', rel, 'Link target leaves source_root; move it into the source or exclude it');
  const canonicalRel = toPosix(path.relative(bundle.root, canonical));
  const info = await stat(canonical);
  if (info.isDirectory()) {
    bundle.dirs.add(rel);
    if (bundle.walked.has(canonical)) { bundle.aliases.push({ path: rel, alias_of: canonicalRel }); return; }
    bundle.walked.add(canonical);
    const names = [];
    for await (const entry of await opendir(canonical)) if (!skipped.has(entry.name)) names.push(entry.name);
    for (const name of names.sort()) await collect(bundle, posix.join(rel, name), role, depth + 1);
    return;
  }
  if (!info.isFile()) return bundle.find('unsupported_file', rel, 'Only regular files and directories can be imported');
  const content = await readFileBounded(canonical, info.size);
  if (!content) return bundle.find('too_large', rel, `File exceeds ${LIMITS.bytes} bytes`);
  const file = {
    source: rel, role, alias_of: canonicalRel === rel ? undefined : canonicalRel, content,
    hash: digest(content), bytes: content.length, text: !content.includes(0),
    executable: process.platform !== 'win32' && (info.mode & 0o111) !== 0, links: [], destinationLinks: [], adaptations: [],
  };
  if (file.text) file.adapted = adapt(bundle, file);
  bundle.files.set(rel, file);
}

// Reviewed adaptations apply before references are followed, so links an adaptation removes are not required.
function adapt(bundle, file) {
  let text = file.content.toString('utf8');
  for (const item of bundle.adaptations.filter((entry) => entry.file === file.source)) {
    if (item.content !== undefined) { text = item.content; file.rewritten = true; file.adaptations.push(item.index); continue; }
    const count = text.split(item.find).length - 1;
    if (count === 0 || (count > 1 && !item.all)) {
      item.status = count ? 'ambiguous' : 'not_found';
      bundle.find(count ? 'adaptation_ambiguous' : 'adaptation_not_found', `${file.source}#adaptation-${item.index}`, count ? `Matches ${count} times; make find unique or set all` : 'find text does not occur in the source file');
      continue;
    }
    text = text.split(item.find).join(item.replace);
    file.adaptations.push(item.index);
  }
  return text;
}

// A link absent from the source, or from rewritten text, may name a document the destination already owns at the mapped location.
async function destinationReference(bundle, file, link) {
  if (!bundle.destination) return undefined;
  const rel = posix.normalize(posix.join(posix.dirname(bundle.target(file.source)), link.target)).replace(/\/$/, '');
  if (rel === '..' || rel.startsWith('../') || posix.isAbsolute(rel)) return undefined;
  try {
    const real = await realpath(local(bundle.destination, rel));
    return inside(bundle.destination, real) && !inside(bundle.root, real) ? rel : undefined;
  } catch { return undefined; }
}

// Follow Markdown references transitively within source_root.
async function resolveReferences(bundle) {
  const queue = [...bundle.files.values()];
  while (queue.length) {
    const file = queue.shift();
    if (!file.text || !markdown.has(posix.extname(file.source).toLowerCase())) continue;
    const targets = [];
    mapLinks(file.adapted, (link) => { targets.push(link); });
    for (const link of targets) {
      const rel = posix.normalize(posix.join(posix.dirname(file.source), link.target)).replace(/\/$/, '');
      file.links.push({ ...link, rel });
      // A rewrite is authored for the destination, so its links prefer documents the destination already owns.
      const outside = rel === '..' || rel.startsWith('../');
      if (outside || file.rewritten || !(await lstat(local(bundle.root, rel)).then(() => true, () => false))) {
        const owned = await destinationReference(bundle, file, link);
        if (owned) { if (!file.destinationLinks.includes(owned)) file.destinationLinks.push(owned); continue; }
      }
      if (outside) {
        if (bundle.isExcluded(rel)) bundle.excluded.add(rel);
        else bundle.find('outside_root', rel, 'Link target leaves source_root; move it into the source or exclude it');
        continue;
      }
      const before = new Set(bundle.files.keys());
      await collect(bundle, rel, 'reference');
      for (const [key, added] of bundle.files) if (!before.has(key)) queue.push(added);
    }
  }
}

export async function listCandidates(options) {
  const { source, destination } = await projects(options);
  const inventory = await discover({ project_root: source });
  const relative = (file) => toPosix(path.relative(source, file));
  // Asset names can be link names; the canonical path decides whether a file is a skill entry.
  const skillDirs = inventory.assets.map((asset) => relative(asset.path)).filter((rel) => posix.basename(rel) === 'SKILL.md').map((rel) => posix.dirname(rel));
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentions = (text) => skillDirs.filter((dir) => new RegExp(escape(dir) + '(?![\\w.-])').test(text)).map((dir) => `skill:${dir}`);
  const candidates = [];
  for (const dir of skillDirs) {
    const bundle = createBundle(source, []);
    await collect(bundle, dir, 'support');
    const meta = frontmatter(bundle.files.get(`${dir}/SKILL.md`)?.content.toString('utf8') ?? '');
    candidates.push({
      key: `skill:${dir}`, kind: 'skill', path: dir, name: meta.name ?? posix.basename(dir), description: meta.description,
      files: bundle.files.size, bytes: [...bundle.files.values()].reduce((sum, file) => sum + file.bytes, 0),
    });
  }
  for (const asset of inventory.assets) {
    const rel = relative(asset.path);
    if (skillDirs.some((dir) => under(rel, dir))) continue;
    const kind = classify(rel);
    const text = await readFile(asset.path, 'utf8').catch(() => '');
    const description = frontmatter(text).description ?? text.match(/^#\s+(.+)$/m)?.[1];
    const related = mentions(text);
    candidates.push({ key: `${kind}:${rel}`, kind, path: rel, description, related: related.length ? related : undefined, files: 1, bytes: asset.bytes });
  }
  candidates.sort((a, b) => a.path.localeCompare(b.path));
  const diagnostics = inventory.diagnostics.map((item) => ({
    path: inside(source, item.path) ? relative(item.path) : undefined, reason: item.reason,
  }));
  return {
    source: await identity(source), evidence: { source: await evidence(source), destination: await evidence(destination) },
    candidates, diagnostics, truncated: inventory.truncated,
    note: 'Candidates are classified by location only. Judge relevance from their content and the destination evidence, then pass selected paths to plan_import. related names skills a file mentions, such as a command wrapper for a skill.',
  };
}

async function destinationState(destination, source, rel) {
  if (!rel || posix.isAbsolute(rel) || /^[A-Za-z]:/.test(rel) || rel.split('/').some((part) => part === '..' || part === '' || part === '.')) return { unsafe: 'Destination must be a normalized relative path' };
  if (under(rel, '.git')) return { unsafe: 'Destination is inside .git' };
  if (under(rel, '.agents/local')) return { unsafe: '.agents/local is reserved for machine-local bindings' };
  const file = local(destination, rel);
  if (inside(source, file)) return { unsafe: 'Destination is inside source_root; sources must stay unchanged' };
  try {
    const info = await lstat(file);
    if (info.isSymbolicLink()) return { unsafe: 'Destination is a symlink; Agent Weave does not write through links' };
    if (!info.isFile()) return { unsafe: 'Destination exists and is not a regular file' };
    const parent = await realpath(path.dirname(file));
    if (!inside(destination, parent) || inside(source, parent)) return { unsafe: 'Destination parent resolves outside destination_root' };
    const content = await readFileBounded(file, info.size);
    if (!content) return { unsafe: 'Existing destination file is too large to compare' };
    return { state: digest(content), content };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
    try {
      const real = await realpath(dir);
      if (!inside(destination, real) || inside(source, real)) return { unsafe: 'Destination parent resolves outside destination_root' };
      if (!(await stat(real)).isDirectory()) return { unsafe: 'Destination parent is not a directory' };
      return { state: 'absent' };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function diffOps(a, b) {
  const n = a.length;
  const m = b.length;
  if (n * m > 1_000_000) return [...a.map((line) => ['-', line]), ...b.map((line) => ['+', line])];
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push([' ', a[i]]); i++; j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) ops.push(['-', a[i++]]);
    else ops.push(['+', b[j++]]);
  }
  while (i < n) ops.push(['-', a[i++]]);
  while (j < m) ops.push(['+', b[j++]]);
  return ops;
}

export function unifiedDiff(before, after, file) {
  const ops = diffOps(before === undefined ? [] : lines(before), lines(after));
  const output = [`--- ${before === undefined ? '/dev/null' : `a/${file}`}`, `+++ b/${file}`];
  for (let index = 0; index < ops.length;) {
    if (ops[index][0] === ' ') { index++; continue; }
    let last = index;
    for (let probe = index; probe < ops.length && probe - last <= 6; probe++) if (ops[probe][0] !== ' ') last = probe;
    const start = Math.max(0, index - 3);
    const end = Math.min(ops.length, last + 4);
    let oldStart = 1;
    let newStart = 1;
    for (const [sign] of ops.slice(0, start)) { if (sign !== '+') oldStart++; if (sign !== '-') newStart++; }
    const hunk = ops.slice(start, end);
    const oldCount = hunk.filter(([sign]) => sign !== '+').length;
    const newCount = hunk.filter(([sign]) => sign !== '-').length;
    output.push(`@@ -${oldCount ? oldStart : oldStart - 1},${oldCount} +${newCount ? newStart : newStart - 1},${newCount} @@`, ...hunk.map(([sign, line]) => sign + line));
    index = end;
  }
  return output;
}

function adaptationSites(bundle, sourceEvidence, destinationEvidence, mapped) {
  const sites = [];
  const tokens = sourceEvidence.tools.filter((tool) => commands[tool] && !destinationEvidence.tools.includes(tool)).flatMap((tool) => commands[tool].map((command) => [tool, command]));
  for (const file of bundle.files.values()) {
    if (!file.text) continue;
    const text = file.adapted;
    const isMarkdown = markdown.has(posix.extname(file.source).toLowerCase());
    const code = isMarkdown ? [...text.matchAll(codeSpans)].map((match) => [match[0], match.index]) : [[text, 0]];
    for (const [segment, offset] of code) {
      for (const [tool, command] of tokens) {
        for (const match of segment.matchAll(new RegExp(`(?<![\\w./-])${command}(?![\\w-])`, 'g'))) {
          const line = lineOf(text, offset + match.index);
          if (!sites.some((site) => site.file === file.source && site.line === line && site.tool === tool)) {
            sites.push({ kind: 'command', file: file.source, line, tool, text: lines(text)[line - 1].trim().slice(0, 200) });
          }
        }
      }
    }
    if (!isMarkdown) continue;
    for (const match of text.matchAll(/`([\w.-]+(?:\/[\w.-]+)+\/?)`/g)) {
      const rel = trimSlashes(match[1]);
      if (!mapped.has(rel)) sites.push({ kind: 'path', file: file.source, line: lineOf(text, match.index), value: rel });
    }
  }
  return sites;
}

async function existingPathSites(sites, source, destination) {
  const exists = (root, rel) => lstat(local(root, rel)).then(() => true, () => false);
  const result = [];
  for (const site of sites) {
    if (site.kind !== 'path') { result.push(site); continue; }
    if (await exists(source, site.value) && !(await exists(destination, site.value))) result.push({ ...site, detail: 'Exists in source but not in destination and is not imported' });
  }
  return result;
}

function scanContent(bundle, file, text) {
  text.split('\n').forEach((line, index) => {
    const location = `${file.source}:${index + 1}`;
    if (machinePath.test(line)) bundle.find('machine_path', location, 'Absolute home-directory path; replace it with a project-relative path or a local binding');
    if (secrets.some((pattern) => pattern.test(line))) bundle.find('possible_secret', location, 'Looks like a credential; remove it or exclude the file. Detection is heuristic');
    for (const capability of new Set(line.match(/\bmcp__[A-Za-z0-9_-]+/g) ?? [])) bundle.find('external_capability', capability, `Referenced by ${file.source}; the destination needs an equivalent MCP server or fallback`);
  });
  const allowed = posix.basename(file.source) === 'SKILL.md' && frontmatter(text).allowedTools;
  if (allowed) bundle.find('external_capability', `${file.source}#allowed-tools`, `Declares allowed-tools: ${allowed.slice(0, 200)}`);
  if (scripts.has(posix.extname(file.source).toLowerCase()) || text.startsWith('#!') || file.executable) {
    bundle.find('dynamic_dependency', file.source, 'Script copied as data; its imports and required tools are not analyzed or executed');
  }
}

export async function planImport(options) {
  const { source, destination } = await projects(options);
  const { select, exclude = [], mappings = {}, resolutions = {}, adaptations = [], include_preview = true } = options;
  const reviewed = adaptations.map((item, index) => {
    const rewrite = item.content !== undefined;
    if (rewrite === (item.find !== undefined || item.replace !== undefined) || (!rewrite && (typeof item.find !== 'string' || !item.find || typeof item.replace !== 'string'))) {
      throw new Error(`Adaptation ${index} needs either content or both find and replace`);
    }
    return { index, ...item, file: trimSlashes(item.file), status: 'applied' };
  });
  const bundle = createBundle(source, exclude, { adaptations: reviewed, destination, target: (rel) => mapPath(rel, mappings) });
  const selection = [];
  for (const value of select) {
    let rel = selectionPath(value);
    if (posix.basename(rel) === 'SKILL.md') rel = posix.dirname(rel);
    const info = await stat(local(source, rel)).catch(() => undefined);
    if (!info) throw new Error(`Selected path does not exist in source_root: ${rel}`);
    const isSkill = info.isDirectory() && await stat(local(source, `${rel}/SKILL.md`)).then(() => true, () => false);
    if (info.isDirectory() && !isSkill) throw new Error(`Select a skill directory containing SKILL.md or individual files: ${rel}`);
    const kind = isSkill ? 'skill' : classify(rel);
    selection.push({ key: `${kind}:${rel}`, kind, path: rel });
    if (isSkill) {
      await collect(bundle, rel, 'support');
      const entry = bundle.files.get(`${rel}/SKILL.md`);
      if (entry) entry.role = 'entry';
    } else await collect(bundle, rel, 'entry');
  }
  await resolveReferences(bundle);

  const destinations = new Map([...bundle.files.keys(), ...bundle.dirs].map((rel) => [rel, mapPath(rel, mappings)]));
  const files = [];
  const preview = [];
  const seen = new Map();
  let previewLines = 0;
  for (const file of [...bundle.files.values()].sort((a, b) => a.source.localeCompare(b.source))) {
    const target = destinations.get(file.source);
    const record = {
      source: file.source, destination: target, role: file.role, alias_of: file.alias_of, hash: file.hash,
      bytes: file.bytes, executable: file.executable, text: file.text, rewrites: [], adaptations: file.adaptations,
      destination_references: file.destinationLinks.length ? file.destinationLinks.sort() : undefined,
    };
    let result = file.content;
    if (file.text) {
      const links = new Map(file.links.map((link) => [link.target, link]));
      const text = mapLinks(file.adapted, (link) => {
        const known = links.get(link.target);
        const rel = known?.rel ?? posix.normalize(posix.join(posix.dirname(file.source), link.target)).replace(/\/$/, '');
        if (!destinations.has(rel)) return undefined;
        let next = posix.relative(posix.dirname(target), destinations.get(rel)) || posix.basename(destinations.get(rel));
        if (link.target.endsWith('/')) next += '/';
        if (posix.normalize(next) === posix.normalize(link.target)) return undefined;
        record.rewrites.push({ from: link.target, to: next });
        const written = link.encoded ? encodeURI(next) : next;
        return link.wrapped ? `<${written}${link.suffix}>` : `${written}${link.suffix}`;
      });
      scanContent(bundle, file, text);
      result = Buffer.from(text, 'utf8');
    }
    record.result_hash = digest(result);
    const key = target.toLowerCase();
    if (seen.has(key)) bundle.find('duplicate_destination', target, `Both ${seen.get(key)} and ${file.source} map here; add a mapping`);
    seen.set(key, file.source);
    if (!target.includes('/') && entryFiles.has(target)) bundle.find('entry_file', target, 'Destination entry files are user-authored; map this file to another path');
    const state = await destinationState(destination, source, target);
    record.destination_state = state.state ?? 'unsafe';
    if (state.unsafe) { bundle.find('unsafe_destination', target, state.unsafe); record.action = 'blocked'; }
    else if (state.state === 'absent') record.action = 'create';
    else if (state.state === record.result_hash) record.action = 'unchanged';
    else if (resolutions[target] === 'keep_destination') record.action = 'skip';
    else { record.action = 'conflict'; bundle.find('destination_conflict', target, 'Destination already has different content; keep it with resolutions or map elsewhere'); }
    files.push(record);
    if (include_preview && ['create', 'conflict'].includes(record.action)) {
      const entry = { destination: target, action: record.action };
      if (!file.text || (state.content && state.content.includes(0))) entry.binary = { bytes: file.bytes, hash: record.result_hash };
      else {
        const diff = unifiedDiff(state.content?.toString('utf8'), result.toString('utf8'), target);
        const room = Math.max(0, Math.min(LIMITS.diffLines, LIMITS.previewLines - previewLines));
        entry.diff = diff.slice(0, room);
        entry.truncated = diff.length > room || undefined;
        previewLines += entry.diff.length;
      }
      preview.push(entry);
    }
  }
  for (const item of reviewed) {
    if (!bundle.files.get(item.file)?.text) {
      item.status = 'not_found';
      bundle.find('adaptation_not_found', `${item.file}#adaptation-${item.index}`, 'Adaptation file is not a text file in this bundle');
    }
  }
  bundle.find('client_binding_pending', undefined, 'Claude Code and Codex entry points are not generated yet; native invocation is unverified');

  const [sourceIdentity, sourceEvidence, destinationEvidence] = await Promise.all([identity(source, options.source_name), evidence(source), evidence(destination)]);
  const sites = await existingPathSites(adaptationSites(bundle, sourceEvidence, destinationEvidence, destinations), source, destination);
  const findings = bundle.findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'blocking' ? -1 : 1));
  const ready = !findings.some((item) => item.severity === 'blocking');
  const plan_id = digest(stable({
    version: 1, source: sourceIdentity, selection, exclude: [...bundle.excluded].sort(), mappings, resolutions,
    adaptations: reviewed.map(({ file, find, replace, content, all }) => ({ file, find, replace, content, all: Boolean(all) })),
    files: files.map(({ source: from, destination: to, hash, result_hash, destination_state, executable, action, destination_references }) => ({ from, to, hash, result_hash, destination_state, executable, action, destination_references })),
  }));
  return {
    version: 1, plan_id, ready, source: sourceIdentity,
    evidence: { source: sourceEvidence, destination: destinationEvidence },
    selection, files, excluded: [...bundle.excluded].sort(), aliases: bundle.aliases,
    // Rewritten content is shown in the preview diff; echoing it here would double the response.
    adaptations: reviewed.map(({ index, content, ...item }) => content === undefined ? item : { ...item, content_hash: digest(content) }),
    findings, adaptation_sites: sites, preview,
    notes: [
      'Read-only plan. Applying plans is not implemented yet; no files were written.',
      'Adaptations are reviewed inputs, not engine conclusions. They apply before references are followed. Secret and machine-path detection is heuristic.',
      'destination_references are links satisfied by files the destination already owns; they are not copied.',
      'Script dependencies are not analyzed. Out-of-root inclusion is not supported; adapt the link away, exclude it, or move the file into the source.',
    ],
  };
}
