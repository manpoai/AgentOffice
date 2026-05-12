/**
 * Event Translator — converts Gateway SSE events to a MINIMAL doorbell poke.
 *
 * AOSE event delivery is pull-based: the SSE stream + sidecar session.send path
 * is a doorbell, not a mailbox. The complete event data (comment_id, target_id,
 * context_payload with anchor/snippet/thread/write_back_target/recent_edits)
 * lives in the MCP tools `get_unread_events` / `catchup_events`, which the agent
 * pulls through its per-agent MCP socket.
 *
 * Therefore the notification content MUST NOT include:
 *   - comment_id, target_id, actor_id or any other ids
 *   - the comment body / target title / anchor preview / context snippet
 *   - any "reply via" shell command or curl hint
 *
 * Including any of those invites agents to act on the notification directly
 * (bypassing MCP, bypassing context_payload, and bypassing the rate-limit and
 * audit boundaries). Keep the poke content-free; the agent's only correct
 * response is to call get_unread_events through its MCP surface.
 *
 * See mcp-server/skills/03-events-and-collaboration.md ("The Event Model in
 * One Line") for the authoritative design.
 *
 * Shared by: electron/adapter-manager.js and adapters/ npm package.
 */

function poke(eventType) {
  return (
    `[AOSE] New unread event (${eventType}). ` +
    `Do NOT reply with text only. ` +
    `Immediately call get_unread_events NOW, then act on the ` +
    `context_payload (reply_to_comment / update_doc / etc.), ` +
    `then call ack_events. ` +
    `Any text-only response without these tool calls is incorrect — ` +
    `the user will see nothing until the tool calls actually run.`
  );
}

/**
 * Translate a Gateway event into a minimal doorbell message.
 * @param {object} event  Raw Gateway event object
 * @returns {{ content: string } | null}
 */
export function translateEvent(event) {
  switch (event.event) {
    case 'comment.mentioned':
    case 'comment.on_owned_content':
    case 'comment.replied':
    case 'comment.unresolved':
    case 'data.commented':
    case 'comment.mentioned_legacy':
    case 'doc.mentioned':
    case 'message.received':
      return { content: poke(event.event) };

    case 'task.assigned':
      return {
        content:
          `[AOSE] New unread event (task.assigned). ` +
          `Execute this EXACT sequence of tool calls:\n` +
          `1. catchup_events — get the event payload with task_id\n` +
          `2. get_task(task_id) — read the full task: title, text (description), and attachments\n` +
          `3. For EACH attachment of type "skill": call get_skill(attachment_id) to read the skill content — these are your instructions\n` +
          `4. update_task_status(task_id, "in_progress")\n` +
          `5. Execute the task according to the description (text field) and skill instructions from step 3\n` +
          `6. comment_on_task(task_id, "<your progress/result report>")\n` +
          `7. update_task_status(task_id, "done")\n` +
          `8. ack_events\n` +
          `Do NOT skip any step. Do NOT reply with text only. ` +
          `Any response without these tool calls is incorrect.`,
      };

    case 'agent.approved':
      return {
        content:
          '[AOSE] Your registration has been approved. ' +
          'Call whoami, then get_unread_events to start.',
      };

    case 'agent.rejected':
      return {
        content:
          '[AOSE] Your registration has been rejected. ' +
          'Contact the workspace admin.',
      };

    case 'comment.resolved':
      return null;

    default:
      return null;
  }
}
