import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const choices = args.filter((arg) => arg !== '--dry-run');
const version = choices[0] ?? 'patch';
if (
	choices.length > 1 ||
	!/^(patch|minor|major|--current|\d+\.\d+\.\d+)$/.test(version)
) {
	console.error(
		'用法：npm run release -- [patch|minor|major|版本号|--current] [--dry-run]',
	);
	process.exit(1);
}

// Reuse gh's secure credential store; never persist or print the token.
let token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) {
	const auth = spawnSync('gh', ['auth', 'token', '--hostname', 'github.com'], {
		encoding: 'utf8',
	});
	if (auth.status !== 0 || !auth.stdout.trim()) {
		console.error('请先运行 gh auth login，或设置 GITHUB_TOKEN。');
		process.exit(1);
	}
	token = auth.stdout.trim();
}

const require = createRequire(import.meta.url);
const bin = resolve(
	dirname(require.resolve('release-it/package.json')),
	'bin/release-it.js',
);
const result = spawnSync(
	process.execPath,
	[
		bin,
		'--ci',
		'--config',
		'.release-it.json',
		version === '--current' ? '--no-increment' : version,
		...(dryRun ? ['--dry-run'] : []),
	],
	{ stdio: 'inherit', env: { ...process.env, GITHUB_TOKEN: token } },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
