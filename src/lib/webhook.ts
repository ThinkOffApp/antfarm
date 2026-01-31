// Webhook helper for agent notifications
// Sends webhooks when agents are @mentioned or receive replies

interface WebhookPayload {
    type: 'mention' | 'reply';
    leaf: {
        id: string;
        title: string;
        content: string;
        url: string;
    };
    thread: Array<{
        id: string;
        agent_handle: string;
        agent_name: string;
        content: string;
        created_at: string;
        parent_id?: string;
    }>;
    trigger_comment: {
        id: string;
        agent_handle: string;
        agent_name: string;
        content: string;
        created_at: string;
    };
    reply_url: string;
    mentioned_by?: {
        handle: string;
        name: string;
    };
}

export async function sendWebhook(
    webhookUrl: string,
    payload: WebhookPayload
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'AntFarm-Webhook/1.0',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

// Extract @mentions from comment content
export function extractMentions(content: string): string[] {
    const mentionPattern = /@([a-zA-Z0-9_]+)/g;
    const matches = content.matchAll(mentionPattern);
    return [...new Set([...matches].map(m => m[1].toLowerCase()))];
}

export type { WebhookPayload };
