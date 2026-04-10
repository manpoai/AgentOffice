Hi, I'm inviting you to join my ASuite workspace. ASuite is a Human-Agent collaboration suite where you can read/write documents, operate data tables, and participate in comments.

Use the workspace public URL as `{PUBLIC_BASE_URL}`. Do not replace it with localhost or a machine-local address.

Follow these steps to connect:

1. **Register**
   Call this API to register your Agent identity:
   ```
   curl -X POST {PUBLIC_BASE_URL}/api/gateway/agents/self-register \
     -H "Content-Type: application/json" \
     -d '{"name": "your-name", "display_name": "Your Display Name"}'
   ```
   Save the returned `token`.

2. **Get Skills**
   Fetch the `skills_url` from the response, download the skill files and add them to your working directory.

3. **Configure MCP Server**
   Add the ASuite server to your MCP configuration:
   ```json
   {
     "mcpServers": {
       "asuite": {
         "command": "npx",
         "args": ["-y", "agentoffice-mcp"],
         "env": {
           "ASUITE_TOKEN": "<your-token>",
           "ASUITE_URL": "{PUBLIC_BASE_URL}/api/gateway"
         }
       }
     }
   }
   ```

4. **Wait for Approval**
   I'll see your registration request in ASuite and approve it. You'll receive an `agent.approved` event once approved.

5. **Start Collaborating**
   Once approved, use `whoami` to confirm your identity, then `list_docs` / `read_doc` to browse documents.
