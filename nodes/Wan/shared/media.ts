import { IMAGE_MAX_BYTES } from './constants';
import type { Executor, MediaInput, WanMedia } from './types';

export function validateUrl(value: string): string {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error('素材或视频地址必须是完整的 HTTP/HTTPS URL');
	}
	if (
		!['http:', 'https:'].includes(url.protocol) ||
		url.username ||
		url.password
	)
		throw new Error('仅支持不含用户名密码的 HTTP/HTTPS URL');
	return value;
}

export async function resolveMedia(
	executor: Executor,
	itemIndex: number,
	inputs: MediaInput[],
): Promise<WanMedia[]> {
	const output: WanMedia[] = [];
	for (const input of inputs) {
		if (typeof input.value !== 'string' || !input.value.trim())
			throw new Error('请填写素材 URL 或 Binary 属性名');
		const value = input.value.trim();
		if (input.source === 'url') {
			output.push({ type: input.type, url: validateUrl(value) });
			continue;
		}
		if (
			input.source !== 'binary' ||
			!['first_frame', 'last_frame', 'reference_image'].includes(input.type)
		)
			throw new Error('仅图片支持 Binary；视频和音频请使用 URL');
		if (!executor.getInputData()[itemIndex]?.binary?.[value])
			throw new Error(`找不到 Binary 图片属性：${value}`);
		const bytes = await executor.helpers.getBinaryDataBuffer(itemIndex, value);
		if (!bytes.length || bytes.length > IMAGE_MAX_BYTES)
			throw new Error('Binary 图片不能为空，且不能超过 20 MB');
		const mime =
			bytes.length >= 12 &&
			bytes
				.subarray(0, 8)
				.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
				? 'image/png'
				: bytes.length >= 4 &&
					  bytes[0] === 255 &&
					  bytes[1] === 216 &&
					  bytes[2] === 255
					? 'image/jpeg'
					: bytes.length >= 26 && bytes.toString('ascii', 0, 2) === 'BM'
						? 'image/bmp'
						: bytes.length >= 16 &&
							  bytes.toString('ascii', 0, 4) === 'RIFF' &&
							  bytes.toString('ascii', 8, 12) === 'WEBP'
							? 'image/webp'
							: undefined;
		if (!mime) throw new Error('图片仅支持 JPEG、PNG、BMP 或 WEBP');
		output.push({
			type: input.type,
			url: `data:${mime};base64,${bytes.toString('base64')}`,
		});
	}
	return output;
}
