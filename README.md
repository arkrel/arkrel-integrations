# n8n-nodes-arkrel

An [n8n](https://n8n.io) community node for [Arkrel](https://arkrel.com): documents in, verified data out.

Send invoices, receipts, bank statements, purchase orders and delivery notes to Arkrel from any n8n workflow and get back structured data with the checks that apply already run: line items and totals are cross-checked, bank statement balances are reconciled, and problems are flagged with a reason instead of being silently dropped.

## Installation

In n8n: **Settings > Community Nodes > Install**, then enter `n8n-nodes-arkrel`.

See the [n8n community nodes guide](https://docs.n8n.io/integrations/community-nodes/installation/) for details.

## Credentials

1. Sign in at [arkrel.com](https://arkrel.com) and create an API key on the **API keys** page.
2. In n8n, add an **Arkrel API** credential and paste the key. Leave **API Base URL** as `https://arkrel.com`.

## Nodes

### Arkrel

| Operation | What it does |
|---|---|
| Upload Document | Sends a file (binary data from a previous node, or base64) to be extracted and verified. Choose the document type: invoice, receipt, bank statement, purchase order, delivery note, or a custom schema. Optional: metadata, idempotency key, webhook URL override. |
| Get Result | Fetches the result for a document ID as JSON, CSV or XLSX, or for bank statements as QuickBooks CSV, Xero CSV or OFX. |

### Arkrel Trigger

Starts a workflow when a document reaches a result: succeeded, partial, needs review, or failed. Arkrel signs every webhook delivery and the trigger verifies the signature before the workflow runs.

## Example

Gmail (new email with attachment) > **Arkrel: Upload Document** > **Arkrel Trigger** (document succeeded) > Google Sheets (append row).

## Bank statements

Arkrel reads the transaction table in any bank's PDF statement, checks every running balance, and exports a CSV ready for QuickBooks or Xero. Bank guides: [Chase](https://arkrel.com/banks/chase), [Bank of America](https://arkrel.com/banks/bank-of-america), [Wells Fargo](https://arkrel.com/banks/wells-fargo), [Capital One](https://arkrel.com/banks/capital-one), [U.S. Bank](https://arkrel.com/banks/us-bank), and [every other bank](https://arkrel.com/banks). Bookkeeping firms doing catch-up work: [arkrel.com/for-accountants](https://arkrel.com/for-accountants).

## Also in this repository

None of these are part of the npm package.

- [`mcp/`](mcp): ready-made configs for Arkrel's MCP server (`https://arkrel.com/mcp`) in Claude Code, Claude Desktop, Cursor and VS Code, plus the listing for the official MCP Registry (`com.arkrel/arkrel`).
- [`cursor/`](cursor): the Arkrel plugin for Cursor (MCP server plus a rule).
- [`gemini-extension.json`](gemini-extension.json): the Arkrel extension for Gemini CLI. Install with `gemini extensions install https://github.com/arkrel/arkrel-integrations`.

## Resources

- Documentation: https://arkrel.com/docs
- API reference: https://arkrel.com/docs/api-reference
- Support: support@arkrel.com

## License

MIT. Arkrel is a product of Conecta Media LLC.
