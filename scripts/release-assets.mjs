import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [action, version] = process.argv.slice(2);
assert.match(version ?? '', /^\d+\.\d+\.\d+$/, 'Release version must be x.y.z');
const repo = 'kkuxb/n8n-nodes-wan';
const tag = `v${version}`;
const directory = resolve('.local', 'releases', version);
const filename = `n8n-nodes-wan-${version}.tgz`;
const json = (path) =>
	JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const sha256 = (path) =>
	createHash('sha256').update(readFileSync(path)).digest('hex');

function command(binary, args) {
	const result = spawnSync(binary, args, { encoding: 'utf8' });
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(`${binary} failed: ${result.stderr.trim()}`);
	return result.stdout.trim();
}

function notes() {
	const sections = readFileSync('CHANGELOG.md', 'utf8').split(/^## /m);
	const section = sections.find((item) => item.startsWith(`${version} —`));
	assert.ok(section, `请先在 CHANGELOG.md 添加 ${version} 的更新说明。`);
	return (
		`## ${section.trim()}\n\n` +
		'安装：在 n8n「设置 → 社区节点」中输入 `n8n-nodes-wan`。\n\n' +
		`附件包含 ${filename} 和 SHA256SUMS.txt。\n`
	);
}

if (action === 'notes') {
	console.log(notes());
} else if (action === 'check') {
	notes();
	const url = command('git', ['remote', 'get-url', 'origin']);
	assert.match(
		url,
		/^(https:\/\/github\.com\/|git@github\.com:)kkuxb\/n8n-nodes-wan(?:\.git)?$/,
	);
	const existing = spawnSync(
		'git',
		['rev-parse', '--verify', `${tag}^{commit}`],
		{ encoding: 'utf8' },
	);
	if (existing.status === 0) {
		assert.equal(
			existing.stdout.trim(),
			command('git', ['rev-parse', 'HEAD']),
			'已有 tag 不指向当前提交，禁止移动已发布 tag',
		);
	}
	console.log(`${tag}: release notes and repository verified`);
} else if (action === 'pack') {
	const pkg = json('package.json');
	const lock = json('package-lock.json');
	assert.equal(pkg.version, version);
	assert.equal(lock.version, version);
	assert.equal(lock.packages[''].version, version);
	assert.ok(process.env.npm_execpath, '请通过 npm run release 执行');
	mkdirSync(directory, { recursive: true });
	const [archive] = JSON.parse(
		command(process.execPath, [
			process.env.npm_execpath,
			'pack',
			'--json',
			'--ignore-scripts',
			'--pack-destination',
			directory,
		]),
	);
	assert.equal(archive.filename, filename);
	assert.ok(
		archive.files.some((file) => file.path === 'dist/nodes/Wan/Wan.node.js'),
	);
	assert.ok(
		archive.files.some(
			(file) => file.path === 'dist/credentials/MaibaoWanApi.credentials.js',
		),
	);
	assert.ok(
		archive.files.every(
			(file) =>
				!/(^|\/)(\.local|\.env|node_modules|scripts|test)(\/|$)/.test(
					file.path,
				),
		),
	);
	writeFileSync(
		resolve(directory, 'SHA256SUMS.txt'),
		`${sha256(resolve(directory, filename))}  ${filename}\n`,
	);
	console.log(`Prepared ${filename} and SHA256SUMS.txt`);
} else if (action === 'verify') {
	const head = command('git', ['rev-parse', 'HEAD']);
	assert.equal(command('git', ['rev-parse', `${tag}^{commit}`]), head);
	const refs = command('git', [
		'ls-remote',
		'origin',
		'refs/heads/master',
		`refs/tags/${tag}^{}`,
	]);
	for (const ref of ['refs/heads/master', `refs/tags/${tag}^{}`]) {
		assert.ok(
			refs.split('\n').some((line) => line.trim() === `${head}\t${ref}`),
			`远端 ${ref} 未同步`,
		);
	}
	const release = JSON.parse(
		command('gh', ['api', `repos/${repo}/releases/tags/${tag}`]),
	);
	assert.equal(release.draft, false);
	assert.equal(release.prerelease, false);
	for (const name of [filename, 'SHA256SUMS.txt']) {
		const asset = release.assets.find((item) => item.name === name);
		assert.equal(asset?.state, 'uploaded', `缺少附件 ${name}`);
		assert.equal(
			asset.digest,
			`sha256:${sha256(resolve(directory, name))}`,
			`附件校验失败：${name}`,
		);
	}
	console.log(`已核验分支、tag、Release 和附件：${release.html_url}`);
} else {
	throw new Error(`Unknown release action: ${action}`);
}
