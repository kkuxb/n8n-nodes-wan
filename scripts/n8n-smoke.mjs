// Query-only smoke test in an isolated real n8n CLI profile. Never creates a paid task.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const runtime = process.env.WAN_N8N_RUNTIME;
const helper = process.env.WAN_CREDENTIAL_HELPER;
if (!runtime || !helper)
	throw new Error('Set WAN_N8N_RUNTIME and WAN_CREDENTIAL_HELPER');
const root = path.resolve('.local/n8n-smoke');
fs.mkdirSync(root, { recursive: true });
const credential = spawnSync(
	'python',
	[
		'-c',
		'import sys; sys.path.insert(0,sys.argv[1]); from credential_store import load_key; sys.stdout.write(load_key())',
		helper,
	],
	{ encoding: 'utf8', windowsHide: true },
);
if (credential.status || !credential.stdout.trim())
	throw new Error('Credential unavailable');
const secret = credential.stdout.trim();
credential.stdout = '';
const credentialFile = path.join(root, 'credential-import.json');
fs.writeFileSync(
	credentialFile,
	JSON.stringify([
		{
			id: 'wanSmokeCredential',
			name: 'Wan local acceptance',
			type: 'maibaoWanApi',
			data: { apiKey: secret, baseUrl: 'https://ai.maibao.chat' },
		},
	]),
);
const result = JSON.parse(
	fs.readFileSync('.local/live/default-1080p/result.json'),
);
const workflow = {
	id: 'wanSmokeWorkflow',
	name: 'Wan query acceptance',
	active: false,
	settings: { executionOrder: 'v1' },
	nodes: [
		{
			id: 'trigger',
			name: 'Manual Trigger',
			type: 'n8n-nodes-base.manualTrigger',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		},
		{
			id: 'wan',
			name: 'Wan 视频生成',
			type: 'CUSTOM.wan',
			typeVersion: 1,
			position: [240, 0],
			parameters: {
				operation: 'get',
				taskId: result.taskId,
				waitForCompletion: true,
				downloadVideo: true,
			},
			credentials: {
				maibaoWanApi: {
					id: 'wanSmokeCredential',
					name: 'Wan local acceptance',
				},
			},
		},
	],
	connections: {
		'Manual Trigger': {
			main: [[{ node: 'Wan 视频生成', type: 'main', index: 0 }]],
		},
	},
};
const workflowFile = path.join(root, 'workflow.json');
fs.writeFileSync(workflowFile, JSON.stringify(workflow));
const env = {
	...process.env,
	N8N_USER_FOLDER: path.join(root, 'profile'),
	N8N_CUSTOM_EXTENSIONS: path.resolve('dist'),
	N8N_DIAGNOSTICS_ENABLED: 'false',
	N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
	N8N_DEFAULT_BINARY_DATA_MODE: 'filesystem',
	N8N_RUNNERS_ENABLED: 'false',
	N8N_LOG_LEVEL: 'info',
};
const cli = path.join(runtime, 'node_modules/n8n/bin/n8n');
function command(name, args) {
	const run = spawnSync(process.execPath, [cli, ...args], {
		env,
		encoding: 'utf8',
		windowsHide: true,
		timeout: 180000,
		maxBuffer: 30 * 1024 * 1024,
	});
	const stdout = (run.stdout ?? '').split(secret).join('[REDACTED]');
	const stderr = (run.stderr ?? '').split(secret).join('[REDACTED]');
	fs.writeFileSync(path.join(root, `${name}.stdout.log`), stdout);
	fs.writeFileSync(path.join(root, `${name}.stderr.log`), stderr);
	console.log(
		JSON.stringify({
			command: name,
			exitCode: run.status,
			error: run.error?.code,
		}),
	);
	if (run.status !== 0)
		throw new Error(`${name} failed; inspect local redacted logs`);
	return stdout;
}
try {
	command('import-credentials', [
		'import:credentials',
		`--input=${credentialFile}`,
	]);
} finally {
	fs.unlinkSync(credentialFile);
}
command('import-workflow', ['import:workflow', `--input=${workflowFile}`]);
const stdout = command('execute', [
	'execute',
	'--id=wanSmokeWorkflow',
	'--rawOutput',
]);
let data;
for (let i = stdout.indexOf('{'); i >= 0; i = stdout.indexOf('{', i + 1)) {
	try {
		data = JSON.parse(stdout.slice(i).trim());
		break;
	} catch {
		/* skip log prefixes */
	}
}
if (!data) throw new Error('Cannot parse actual n8n execution output');
const resultData = data.data?.resultData ?? data.resultData;
const wan = resultData?.runData?.['Wan 视频生成']?.[0]?.data?.main?.[0]?.[0];
const summary = {
	finished: data.finished,
	status: data.status,
	isSuccess: wan?.json?.isSuccess,
	downloaded: wan?.json?.downloaded,
	taskId: wan?.json?.taskId,
	binary: wan?.binary?.video,
	error: resultData?.error?.message,
};
fs.writeFileSync(
	path.join(root, 'summary.json'),
	JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary));
if (!summary.isSuccess || !summary.downloaded || !summary.binary)
	throw new Error('n8n workflow did not produce a downloaded video');
