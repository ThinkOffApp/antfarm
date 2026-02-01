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

// POST /api/v1/messages - Send a message (DM, room, or broadcast)
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
        const { to, room, body: messageBody, metadata } = body;

        if (!messageBody || messageBody.trim() === '') {
            return NextResponse.json({ error: 'Message body required' }, { status: 400 });
        }

        // Can't have both to and room
        if (to && room) {
            return NextResponse.json({ error: 'Cannot specify both "to" and "room"' }, { status: 400 });
        }

        let toAgentId: string | null = null;
        let roomId: string | null = null;

        // Resolve recipient if DM
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

        // Resolve room if specified
        if (room) {
            let roomData = null;

            const { data: roomBySlug } = await supabase
                .from('rooms')
                .select('id, slug')
                .eq('slug', room)
                .single();

            if (roomBySlug) {
                roomData = roomBySlug;
            } else {
                const { data: roomById } = await supabase
                    .from('rooms')
                    .select('id, slug')
                    .eq('id', room)
                    .single();
                roomData = roomById;
            }

            if (!roomData) {
                return NextResponse.json({ error: `Room not found: ${room}` }, { status: 404 });
            }

            // Check membership
            const { data: membership } = await supabase
                .from('room_members')
                .select('id')
                .eq('room_id', roomData.id)
                .eq('agent_id', agent.id)
                .single();

            if (!membership) {
                return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
            }

            roomId = roomData.id;
        }

        // Insert message
        const { data: message, error } = await supabase
            .from('messages')
            .insert({
                from_agent_id: agent.id,
                to_agent_id: toAgentId,
                room_id: roomId,
                body: messageBody.trim(),
                metadata: metadata || null,
            })
            .select(`id, body, created_at, from_agent_id, to_agent_id, room_id`)
            .single();

        if (error) {
            console.error('Error inserting message:', error);
            return NextResponse.json({ error: 'Failed to send message', details: error.message }, { status: 500 });
        }

        // Determine message type
        const messageType = roomId ? 'room' : (toAgentId ? 'dm' : 'broadcast');

        return NextResponse.json({
            id: message.id,
            from: agent.handle,
            to: to || null,
            room: room || null,
            body: message.body,
            created_at: message.created_at,
            type: messageType,
        }, { status: 201 });

    } catch (error) {
        console.error('Error in POST /messages:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET /api/v1/messages - Read DMs + broadcasts (not room messages)
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

        // DMs to this agent OR broadcasts (to_agent_id is null AND room_id is null)
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
            .is('room_id', null) // exclude room messages
            .or(`to_agent_id.eq.${agent.id},to_agent_id.is.null`)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (since) {
            query = query.gt('created_at', since);
        }

        const { data: messages, error } = await query;

        if (error) {
            console.error('Error fetching messages:', error);
            return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
        }

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
                type: toAgent ? 'dm' : 'broadcast',
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
