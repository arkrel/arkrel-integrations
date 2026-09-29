# Arkrel MCP server

Arkrel runs a remote MCP server at `https://arkrel.com/mcp` (Streamable HTTP). It lets an AI assistant upload a document, wait for it, and read back the verified fields, tables and check results.

You need an Arkrel API key: sign in at [arkrel.com](https://arkrel.com), open API keys, create one. Replace `YOUR_ARKREL_API_KEY` in the file for your client.

| Client | File | Where it goes |
| --- | --- | --- |
| Claude Code | [`claude-code.sh`](claude-code.sh) | Run it once in a terminal |
| Claude Desktop | [`claude-desktop.json`](claude-desktop.json) | Merge into `claude_desktop_config.json` |
| Cursor | [`cursor.json`](cursor.json) | Merge into `~/.cursor/mcp.json` or `.cursor/mcp.json` |
| VS Code | [`vscode.json`](vscode.json) | Merge into `.vscode/mcp.json` (prompts for the key, so it is never saved in the file) |

[`server.json`](server.json) is the listing for the official MCP Registry under the `com.arkrel` namespace.

Full docs: https://arkrel.com/docs/mcp-server
