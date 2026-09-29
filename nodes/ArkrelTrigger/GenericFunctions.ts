import { createHmac, timingSafeEqual } from 'node:crypto';

/** Header that carries the webhook signature on every Arkrel delivery. */
export const WEBHOOK_SIGNATURE_HEADER = 'x-webhook-signature';

/**
 * Verifies an Arkrel webhook signature.
 *
 * Per https://arkrel.com/docs/api-reference, webhook requests carry a signature header in
 * the form `t=<unix_seconds>,v1=<hex hmac-sha256>` where the HMAC is
 * computed over the string `${timestamp}.${rawBody}` using the webhook's
 * signing secret. Requests older than `toleranceSeconds` (default 300 = the
 * documented 5 minute replay window) are rejected even if the signature is
 * otherwise valid.
 *
 * This is pure and has no n8n dependency so it can be unit tested directly
 * (see test/GenericFunctions.test.mts) without a running n8n instance.
 */
export interface SignatureVerificationResult {
	valid: boolean;
	reason?: string;
}

export function parseSignatureHeader(header: string): { timestamp: string; signature: string } | undefined {
	const parts = header.split(',').reduce<Record<string, string>>((acc, part) => {
		const [key, value] = part.split('=');
		if (key && value) acc[key.trim()] = value.trim();
		return acc;
	}, {});
	if (!parts.t || !parts.v1) return undefined;
	return { timestamp: parts.t, signature: parts.v1 };
}

export function verifyWebhookSignature(
	signingSecret: string,
	signatureHeader: string | undefined,
	rawBody: string,
	options: { toleranceSeconds?: number; now?: number } = {},
): SignatureVerificationResult {
	const toleranceSeconds = options.toleranceSeconds ?? 300;
	const now = options.now ?? Math.floor(Date.now() / 1000);

	if (!signatureHeader) {
		return { valid: false, reason: 'missing signature header' };
	}

	const parsed = parseSignatureHeader(signatureHeader);
	if (!parsed) {
		return { valid: false, reason: 'malformed signature header' };
	}

	const timestamp = Number(parsed.timestamp);
	if (!Number.isFinite(timestamp)) {
		return { valid: false, reason: 'malformed timestamp' };
	}

	if (Math.abs(now - timestamp) > toleranceSeconds) {
		return { valid: false, reason: 'timestamp outside replay window' };
	}

	const expected = createHmac('sha256', signingSecret)
		.update(`${parsed.timestamp}.${rawBody}`)
		.digest('hex');

	const expectedBuffer = Buffer.from(expected, 'hex');
	const actualBuffer = Buffer.from(parsed.signature, 'hex');

	if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
		return { valid: false, reason: 'signature mismatch' };
	}

	return { valid: true };
}
