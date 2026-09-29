import type {
	IDataObject,
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { WEBHOOK_SIGNATURE_HEADER, verifyWebhookSignature } from './GenericFunctions';

/**
 * Webhook trigger: starts the workflow when a document reaches a terminal
 * state. Registers a webhook with the API (POST /v1/webhooks) when the
 * workflow is activated, verifies every incoming delivery's HMAC signature
 * before handing data to the workflow, and de-registers the webhook
 * (DELETE /v1/webhooks/{id}) when the workflow is deactivated or the node
 * is removed. Endpoints and payloads: https://arkrel.com/docs/api-reference
 */
const ALL_EVENTS = [
	'document.succeeded',
	'document.partial',
	'document.failed',
	'document.needs_review',
] as const;

export class ArkrelTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Arkrel Trigger',
		name: 'arkrelTrigger',
		icon: { light: 'file:../../icons/arkrel.svg', dark: 'file:../../icons/arkrel.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when Arkrel finishes processing a document',
		defaults: {
			name: 'Arkrel Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'arkrelApi',
				required: true,
			},
		],
		documentationUrl: 'https://arkrel.com/docs',
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: ALL_EVENTS.map((event) => ({ name: event, value: event })),
				default: ['document.succeeded'],
				required: true,
				description: 'Which document result events should start this workflow',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (!webhookData.webhookId) {
					return false;
				}

				const credentials = await this.getCredentials('arkrelApi');
				try {
					const existing = (await this.helpers.httpRequestWithAuthentication.call(this, 'arkrelApi', {
						method: 'GET',
						url: `${credentials.baseUrl}/v1/webhooks/${webhookData.webhookId}`,
						json: true,
					})) as IDataObject;
					return existing.url === this.getNodeWebhookUrl('default');
				} catch {
					// The webhook is gone server-side (deleted from the dashboard,
					// for example): forget the stale id so 'create' runs again.
					delete webhookData.webhookId;
					delete webhookData.signingSecret;
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events', []) as string[];
				if (events.length === 0) {
					throw new NodeOperationError(this.getNode(), 'Select at least one event to trigger on');
				}

				const credentials = await this.getCredentials('arkrelApi');
				const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'arkrelApi', {
					method: 'POST',
					url: `${credentials.baseUrl}/v1/webhooks`,
					body: { url: webhookUrl, events },
					json: true,
				})) as IDataObject;

				if (typeof response.id !== 'string' || typeof response.secret !== 'string') {
					throw new NodeOperationError(
						this.getNode(),
						'Arkrel did not return a webhook id and signing secret',
					);
				}

				const webhookData = this.getWorkflowStaticData('node');
				webhookData.webhookId = response.id;
				webhookData.signingSecret = response.secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (!webhookData.webhookId) {
					return true;
				}

				const credentials = await this.getCredentials('arkrelApi');
				try {
					await this.helpers.httpRequestWithAuthentication.call(this, 'arkrelApi', {
						method: 'DELETE',
						url: `${credentials.baseUrl}/v1/webhooks/${webhookData.webhookId}`,
					});
				} catch (error) {
					// Usually the webhook was already removed on the Arkrel side. Deactivation
					// still succeeds, but the reason is logged instead of being hidden.
					this.logger.warn('Arkrel Trigger: could not delete the webhook on deactivation', {
						webhookId: webhookData.webhookId,
						error: (error as Error).message,
					});
				}
				delete webhookData.webhookId;
				delete webhookData.signingSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const webhookData = this.getWorkflowStaticData('node');
		const headerData = this.getHeaderData() as IDataObject;
		const bodyData = this.getBodyData() as IDataObject;

		const req = this.getRequestObject() as unknown as { rawBody?: Buffer };
		const rawBody = (req.rawBody ?? Buffer.from(JSON.stringify(bodyData))).toString('utf8');
		const signatureHeader = headerData[WEBHOOK_SIGNATURE_HEADER] as string | undefined;

		const verification = verifyWebhookSignature(
			(webhookData.signingSecret as string) ?? '',
			signatureHeader,
			rawBody,
		);

		if (!verification.valid) {
			throw new NodeOperationError(
				this.getNode(),
				`Rejected Arkrel webhook delivery: ${verification.reason}`,
			);
		}

		const selectedEvents = this.getNodeParameter('events', []) as string[];
		if (typeof bodyData.event === 'string' && !selectedEvents.includes(bodyData.event)) {
			// A webhook can be shared for more events than this trigger wants
			// (e.g. the dashboard-level webhook the account already has); do
			// not start the workflow for an event nobody asked for.
			return { noWebhookResponse: true };
		}

		return {
			workflowData: [[{ json: bodyData }]],
		};
	}
}
