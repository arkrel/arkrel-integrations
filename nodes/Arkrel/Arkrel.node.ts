import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

/**
 * Arkrel node: upload a document for extraction, and fetch the verified
 * result once it is done. Uses the public REST API
 * (https://arkrel.com/docs/api-reference):
 *   POST /v1/documents
 *   GET  /v1/documents/{id}/result?format=json|csv|xlsx|qbo_csv|xero_csv|ofx
 */
export class Arkrel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Arkrel',
		name: 'arkrel',
		icon: { light: 'file:../../icons/arkrel.svg', dark: 'file:../../icons/arkrel.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Upload documents to Arkrel for verified data extraction and fetch results',
		defaults: {
			name: 'Arkrel',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'arkrelApi',
				required: true,
			},
		],
		documentationUrl: 'https://arkrel.com/docs',
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Upload Document',
						value: 'uploadDocument',
						description: 'Send a document to be extracted and verified',
						action: 'Upload a document',
					},
					{
						name: 'Get Result',
						value: 'getResult',
						description: 'Fetch the extraction result for a document',
						action: 'Get a document result',
					},
				],
				default: 'uploadDocument',
			},

			// ---------------- Upload Document ----------------
			{
				displayName: 'Input Type',
				name: 'inputType',
				type: 'options',
				displayOptions: { show: { operation: ['uploadDocument'] } },
				options: [
					{ name: 'Binary Data (From a Previous Node)', value: 'binary' },
					{ name: 'Base64 Content', value: 'base64' },
				],
				default: 'binary',
				description: 'Whether the document comes from a binary property on the input item or as base64 text you provide directly',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: { show: { operation: ['uploadDocument'], inputType: ['binary'] } },
				description: 'Name of the binary property on the input item that holds the file to upload',
			},
			{
				displayName: 'Filename',
				name: 'filename',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['uploadDocument'], inputType: ['base64'] } },
				description: 'Filename to send, including extension (e.g. invoice.pdf)',
			},
			{
				displayName: 'Content (Base64)',
				name: 'contentBase64',
				type: 'string',
				default: '',
				required: true,
				typeOptions: { rows: 4 },
				displayOptions: { show: { operation: ['uploadDocument'], inputType: ['base64'] } },
				description: 'Base64-encoded file content',
			},
			{
				displayName: 'Document Type',
				name: 'documentType',
				type: 'options',
				displayOptions: { show: { operation: ['uploadDocument'] } },
				options: [
					{ name: 'Bank Statement', value: 'bank_statement' },
					{ name: 'Custom (Schema)', value: 'custom' },
					{ name: 'Delivery Note', value: 'delivery_note' },
					{ name: 'Invoice', value: 'invoice' },
					{ name: 'Purchase Order', value: 'purchase_order' },
					{ name: 'Receipt', value: 'receipt' },
				],
				default: 'invoice',
				description: 'The kind of document. It decides which fields are extracted and which checks run (for example, balance checks for bank statements).',
			},
			{
				displayName: 'Schema ID',
				name: 'schemaId',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['uploadDocument'], documentType: ['custom'] } },
				description: 'ID of a custom extraction schema created under Schemas in the dashboard',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { operation: ['uploadDocument'] } },
				options: [
					{
						displayName: 'Webhook URL Override',
						name: 'webhookUrl',
						type: 'string',
						default: '',
						description: 'Send the result for this document to a specific webhook URL instead of your account-level webhooks',
					},
					{
						displayName: 'Metadata (JSON)',
						name: 'metadata',
						type: 'json',
						default: '{}',
						description: 'Arbitrary JSON metadata to attach to the document (echoed back in results and webhooks)',
					},
					{
						displayName: 'Idempotency Key',
						name: 'idempotencyKey',
						type: 'string',
						default: '',
						description: 'Optional key so retrying this node execution does not create a duplicate document',
					},
				],
			},

			// ---------------- Get Result ----------------
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['getResult'] } },
				description: 'The ID returned when the document was uploaded',
			},
			{
				displayName: 'Format',
				name: 'format',
				type: 'options',
				displayOptions: { show: { operation: ['getResult'] } },
				// OFX, QuickBooks CSV and Xero CSV are bank-statement-only exports: the API
				// answers 400 for any other document type, or for a bank statement with no
				// transaction rows (see GET /v1/documents/{id}/result in the API reference).
				options: [
					{ name: 'CSV', value: 'csv' },
					{ name: 'JSON', value: 'json' },
					{ name: 'OFX (Bank Statements Only)', value: 'ofx' },
					{ name: 'QuickBooks CSV (Bank Statements Only)', value: 'qbo_csv' },
					{ name: 'Xero CSV (Bank Statements Only)', value: 'xero_csv' },
					{ name: 'XLSX', value: 'xlsx' },
				],
				default: 'json',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'uploadDocument') {
					const inputType = this.getNodeParameter('inputType', i) as string;
					const documentType = this.getNodeParameter('documentType', i, 'invoice') as string;
					const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

					// Both input types go through the endpoint's JSON form
					// (filename + content_base64). helpers.httpRequest has no
					// 'formData' option (that belongs to the legacy helpers.request),
					// so a multipart body would silently be sent empty.
					let body: IDataObject;
					if (inputType === 'binary') {
						const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
						const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
						const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
						body = { filename: binaryData.fileName || 'document', content_base64: buffer.toString('base64') };
					} else {
						const filename = this.getNodeParameter('filename', i) as string;
						const contentBase64 = this.getNodeParameter('contentBase64', i) as string;
						body = { filename, content_base64: contentBase64 };
					}

					if (documentType) body.document_type = documentType;
					if (additionalFields.webhookUrl) body.webhook_url = additionalFields.webhookUrl as string;
					if (additionalFields.metadata) {
						let metadata: unknown = additionalFields.metadata;
						if (typeof metadata === 'string') {
							try {
								metadata = JSON.parse(metadata);
							} catch {
								metadata = null;
							}
						}
						if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
							throw new NodeOperationError(this.getNode(), 'Metadata must be a JSON object, like {"customer": "Acme"}', {
								itemIndex: i,
							});
						}
						body.metadata = metadata as IDataObject;
					}

					if (documentType === 'custom') {
						const schemaId = this.getNodeParameter('schemaId', i, '') as string;
						if (schemaId) body.schema_id = schemaId;
					}

					const headers: IDataObject = {};
					if (additionalFields.idempotencyKey) {
						headers['Idempotency-Key'] = additionalFields.idempotencyKey;
					}

					const credentials = await this.getCredentials('arkrelApi');
					const response = await this.helpers.httpRequestWithAuthentication.call(this, 'arkrelApi', {
						method: 'POST',
						url: `${credentials.baseUrl}/v1/documents`,
						headers,
						body,
						json: true,
					});

					returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
				} else if (operation === 'getResult') {
					const documentId = this.getNodeParameter('documentId', i) as string;
					const format = this.getNodeParameter('format', i) as string;

					const credentials = await this.getCredentials('arkrelApi');
					// Exports other than JSON can be binary (XLSX), so they are read as raw
					// bytes; decoding them as text would corrupt the file.
					const response = await this.helpers.httpRequestWithAuthentication.call(this, 'arkrelApi', {
						method: 'GET',
						url: `${credentials.baseUrl}/v1/documents/${documentId}/result`,
						qs: { format },
						json: format === 'json',
						...(format === 'json' ? {} : { encoding: 'arraybuffer' as const }),
					});

					if (format === 'json') {
						returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
					} else {
						const binary = await this.helpers.prepareBinaryData(
							Buffer.isBuffer(response)
								? response
								: typeof response === 'string'
									? Buffer.from(response)
									: Buffer.from(response as ArrayBuffer),
							`${documentId}.${format}`,
						);
						returnData.push({
							json: { documentId, format },
							binary: { data: binary },
							pairedItem: { item: i },
						});
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeApiError(
					this.getNode(),
					{ message: (error as Error).message } as JsonObject,
					{ message: 'Arkrel API request failed' },
				);
			}
		}

		return [returnData];
	}
}
