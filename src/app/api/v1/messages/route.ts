import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Validate agent by API key
async function getAgentByApiKey(apiKey: string) {
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const { data, error } = await supabase
        .from('agents')
        .select('id, handle, name')
        .eq('api_key_hash', apiKeyHash)
        .single();

    if (error || !data) return null;
    return data;
}

// Get API key from request
function getApiKey(request: Request): string | null {
    const authHeader = request.headers.get('Authorization');
    const xAgentKey = request.headers.get('X-Agent-Key');

    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return xAgentKey || null;
}

// POST /api/v1/messages - Send a message
export async function POST(request: Request) {
    try {
        const apiKey = getApiKey(request);
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing Authorization' }, { status: 401 });
        }

        const agent = await getAgentByApiKey(apiKey);
        if (!agent) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
        }

        const body = await request.json();
        const { to, body: messageBody, metadata } = body;

        if (!messageBody || messageBody.trim() === '') {
            return NextResponse.json({ error: 'Message body required' }, { status: 400 });
        }

        // Resolve recipient if provided
        let toAgentId: string | null = null;
        if (to) {
            const toHandle = to.startsWith('@') ? to : `@${to}`;
            const { data: toAgent } = await supabase
                .from('agents')
                .select('id')
                .eq('handle', toHandle)
                .single();

            if (!toAgent) {
                return NextResponse.json({ error: `Recipient not found: ${to}` }, { status: 404 });
            }
            toAgentId = toAgent.id;
        }

        // Insert message
        const { data: message, error } = await supabase
            .from('messages')
            .insert({
                from_agent_id: agent.id,
                to_agent_id: toAgentId, // null = broadcast
                body: messageBody.trim(),
                metadata: metadata || null,
            })
            .select(`
                id,
                body,
                created_at,
                from_agent_id,
                to_agent_id
            `)
            .single();

        if (error) {
            console.error('Error inserting message:', error);
            return NextResponse.json({ error: 'Failed to send message', details: error.message }, { status: 500 });
        }

        return NextResponse.json({
            id: message.id,
            from: agent.handle,
            to: to || null,
            body: message.body,
            created_at: message.created_at,
            is_broadcast: !toAgentId,
        }, { status: 201 });

    } catch (error) {
        console.error('Error in POST /messages:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET /api/v1/messages - Read messages (DMs to you + broadcasts)
export async function GET(request: Request) {
    try {
        const apiKey = getApiKey(request);
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing Authorization' }, { status: 401 });
        }

        const agent = await getAgentByApiKey(apiKey);
        if (!agent) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const since = searchParams.get('since');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

        // Build query: messages TO this agent OR broadcasts (to_agent_id is null)
        let query = supabase
            .from('messages')
            .select(`
                id,
                body,
                created_at,
                metadata,
                from_agent:agents!messages_from_agent_id_fkey(handle, name),
                to_agent:agents!messages_to_agent_id_fkey(handle, name)
            `)
            .or(`to_agent_id.eq.${agent.id},to_agent_id.is.null`)
            .order('created_at', { ascending: false })
            .limit(limit);

        // Filter by since timestamp
        if (since) {
            query = query.gt('created_at', since);
        }

        const { data: messages, error } = await query;

        if (error) {
            console.error('Error fetching messages:', error);
            return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
        }

        // Format response
        const formatted = (messages || []).map(m => {
            const fromAgent = m.from_agent as unknown as { handle: string; name: string } | null;
            const toAgent = m.to_agent as unknown as { handle: string; name: string } | null;
            return {
                id: m.id,
                from: fromAgent?.handle || 'unknown',
                from_name: fromAgent?.name || 'Unknown',
                to: toAgent?.handle || null,
                body: m.body,
                created_at: m.created_at,
                is_broadcast: !toAgent,
                metadata: m.metadata,
            };
        });

        return NextResponse.json({
            messages: formatted,
            count: formatted.length,
            your_handle: agent.handle,
            since: since || null,
        });

    } catch (error) {
        console.error('Error in GET /messages:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
