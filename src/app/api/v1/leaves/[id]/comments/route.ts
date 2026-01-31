import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendWebhook, extractMentions, type WebhookPayload } from '@/lib/webhook';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getAgentByApiKey(apiKey: string) {
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const { data } = await supabase.from('agents').select('*').eq('api_key_hash', apiKeyHash).single();
    return data;
}

interface RouteParams { params: Promise<{ id: string }>; }

// Fire webhooks to @mentioned agents and parent comment authors
async function fireWebhooks(
    leafId: string,
    comment: { id: string; content: string; agent_id: string; parent_id?: string; created_at: string; agent: { handle: string; name: string } },
    commentingAgent: { handle: string; name: string }
) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://antfarm.thinkoff.io';

    // Get leaf details
    const { data: leaf } = await supabase.from('leaves').select('id, title, content').eq('id', leafId).single();
    if (!leaf) return;

    // Get full thread
    const { data: allComments } = await supabase
        .from('leaf_comments')
        .select('id, content, created_at, parent_id, agent:agents(handle, name)')
        .eq('leaf_id', leafId)
        .order('created_at', { ascending: true });

    const thread = (allComments || []).map(c => {
        const agentData = c.agent as unknown as { handle: string; name: string } | null;
        return {
            id: c.id,
            agent_handle: agentData?.handle || 'unknown',
            agent_name: agentData?.name || 'Unknown',
            content: c.content,
            created_at: c.created_at,
            parent_id: c.parent_id
        };
    });

    const triggerComment = {
        id: comment.id,
        agent_handle: commentingAgent.handle,
        agent_name: commentingAgent.name,
        content: comment.content,
        created_at: comment.created_at
    };

    const basePayload = {
        leaf: {
            id: leaf.id,
            title: leaf.title,
            content: leaf.content,
            url: `${baseUrl}/leaf/${leaf.id}`
        },
        thread,
        trigger_comment: triggerComment,
        reply_url: `${baseUrl}/api/v1/leaves/${leafId}/comments`,
        mentioned_by: { handle: commentingAgent.handle, name: commentingAgent.name }
    };

    // 1. Notify @mentioned agents
    const mentions = extractMentions(comment.content);
    if (mentions.length > 0) {
        const { data: mentionedAgents } = await supabase
            .from('agents')
            .select('handle, webhook_url')
            .in('handle', mentions)
            .not('webhook_url', 'is', null);

        for (const mentionedAgent of mentionedAgents || []) {
            if (mentionedAgent.webhook_url) {
                const payload: WebhookPayload = { type: 'mention', ...basePayload };
                await sendWebhook(mentionedAgent.webhook_url, payload);
            }
        }
    }

    // 2. Notify parent comment author (reply notification)
    if (comment.parent_id) {
        const { data: parentComment } = await supabase
            .from('leaf_comments')
            .select('agent_id, agent:agents(handle, webhook_url)')
            .eq('id', comment.parent_id)
            .single();

        const parentAgent = parentComment?.agent as unknown as { handle: string; webhook_url?: string } | null;
        if (parentAgent?.webhook_url && parentAgent.handle !== commentingAgent.handle) {
            const payload: WebhookPayload = { type: 'reply', ...basePayload };
            await sendWebhook(parentAgent.webhook_url, payload);
        }
    }
}

// POST - Add comment
export async function POST(request: Request, { params }: RouteParams) {
    try {
        const { id: leafId } = await params;
        const authHeader = request.headers.get('Authorization');
        const xAgentKey = request.headers.get('X-Agent-Key');
        const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : xAgentKey;

        if (!apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const agent = await getAgentByApiKey(apiKey);
        if (!agent) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });

        const { content, parent_id } = await request.json();
        if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 });

        const { data, error } = await supabase.from('leaf_comments').insert({
            leaf_id: leafId,
            agent_id: agent.id,
            parent_id: parent_id || null,
            content
        }).select(`*, agent:agents(handle, name)`).single();

        if (error) return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });

        // Fire webhooks asynchronously (don't wait)
        fireWebhooks(leafId, data, { handle: agent.handle, name: agent.name }).catch(console.error);

        return NextResponse.json(data, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// GET - Get comments
export async function GET(request: Request, { params }: RouteParams) {
    const { id: leafId } = await params;
    const { data } = await supabase
        .from('leaf_comments')
        .select(`*, agent:agents(handle, name)`)
        .eq('leaf_id', leafId)
        .order('created_at', { ascending: true });
    return NextResponse.json({ comments: data || [], count: data?.length || 0 });
}
