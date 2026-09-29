import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
	WEBHOOK_SIGNATURE_HEADER,
	parseSignatureHeader,
	verifyWebhookSignature,
} from '../nodes/ArkrelTrigger/GenericFunctions.ts';

const SECRET = 'whsec_test_secret';

function sign(secret: string, timestamp: number, body: string): string {
	const hmac = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
	return `t=${timestamp},v1=${hmac}`;
}

test('WEBHOOK_SIGNATURE_HEADER is the header Arkrel signs deliveries with', () => {
	assert.equal(WEBHOOK_SIGNATURE_HEADER, 'x-webhook-signature');
});

test('parseSignatureHeader extracts timestamp and signature', () => {
	const parsed = parseSignatureHeader('t=1700000000,v1=abc123');
	assert.deepEqual(parsed, { timestamp: '1700000000', signature: 'abc123' });
});

test('parseSignatureHeader returns undefined for a malformed header', () => {
	assert.equal(parseSignatureHeader('not-a-valid-header'), undefined);
	assert.equal(parseSignatureHeader('t=123'), undefined);
	assert.equal(parseSignatureHeader(''), undefined);
});

test('verifyWebhookSignature accepts a correctly signed, fresh payload', () => {
	const body = JSON.stringify({ event: 'document.succeeded', document_id: 'doc_123' });
	const now = 1_700_000_000;
	const header = sign(SECRET, now, body);

	const result = verifyWebhookSignature(SECRET, header, body, { now });
	assert.equal(result.valid, true);
});

test('verifyWebhookSignature rejects a missing signature header', () => {
	const result = verifyWebhookSignature(SECRET, undefined, '{}');
	assert.equal(result.valid, false);
	assert.equal(result.reason, 'missing signature header');
});

test('verifyWebhookSignature rejects a malformed signature header', () => {
	const result = verifyWebhookSignature(SECRET, 'garbage', '{}');
	assert.equal(result.valid, false);
	assert.equal(result.reason, 'malformed signature header');
});

test('verifyWebhookSignature rejects a timestamp outside the 5-minute replay window', () => {
	const body = '{"event":"document.failed"}';
	const now = 1_700_000_000;
	const staleHeader = sign(SECRET, now - 301, body);

	const result = verifyWebhookSignature(SECRET, staleHeader, body, { now });
	assert.equal(result.valid, false);
	assert.equal(result.reason, 'timestamp outside replay window');
});

test('verifyWebhookSignature accepts a timestamp exactly at the replay window boundary', () => {
	const body = '{"event":"document.failed"}';
	const now = 1_700_000_000;
	const boundaryHeader = sign(SECRET, now - 300, body);

	const result = verifyWebhookSignature(SECRET, boundaryHeader, body, { now });
	assert.equal(result.valid, true);
});

test('verifyWebhookSignature rejects a signature computed with the wrong secret', () => {
	const body = '{"event":"document.partial"}';
	const now = 1_700_000_000;
	const header = sign('a-different-secret', now, body);

	const result = verifyWebhookSignature(SECRET, header, body, { now });
	assert.equal(result.valid, false);
	assert.equal(result.reason, 'signature mismatch');
});

test('verifyWebhookSignature rejects a payload that was tampered with after signing', () => {
	const originalBody = '{"event":"document.succeeded","document_id":"doc_1"}';
	const tamperedBody = '{"event":"document.succeeded","document_id":"doc_2"}';
	const now = 1_700_000_000;
	const header = sign(SECRET, now, originalBody);

	const result = verifyWebhookSignature(SECRET, header, tamperedBody, { now });
	assert.equal(result.valid, false);
	assert.equal(result.reason, 'signature mismatch');
});

test('verifyWebhookSignature rejects a non-numeric timestamp', () => {
	const result = verifyWebhookSignature(SECRET, 't=not-a-number,v1=abc', '{}');
	assert.equal(result.valid, false);
	assert.equal(result.reason, 'malformed timestamp');
});
