# Arkrel

Arkrel turns documents (invoices, receipts, bank statements, purchase orders, delivery notes) into structured data and runs the checks that apply: line items against totals, opening balance plus transactions against the closing balance, and every running balance row by row.

- Use `extract_document` with a file URL or base64 content and the right `document_type`. Choose `bank_statement` for statements so the balance checks run.
- If the result is not final yet, call `get_document_result` with the returned `document_id`.
- Report the `status` (`succeeded`, `partial`, `needs_review`, `failed`) and, for anything short of `succeeded`, the failed checks and their `detail`, which name the exact row and amount.
- Exports for bookkeeping (QuickBooks CSV, Xero CSV, OFX) are available for bank statements.
- Failed documents do not count toward the user's pages.
