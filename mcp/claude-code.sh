#!/bin/sh
# Adds Arkrel to Claude Code. Replace YOUR_ARKREL_API_KEY with a key from https://arkrel.com (API keys page).
claude mcp add --transport http arkrel https://arkrel.com/mcp --header "Authorization: Bearer YOUR_ARKREL_API_KEY"
