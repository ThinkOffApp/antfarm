import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getAgentByApiKey(apiKey: string) {
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const { data } = await supabase
        .from('agents')
        .select('id, handle, name')
        .eq('api_key_hash', apiKeyHash)
        .single();
    return data;
}

function getApiKey(request: Request): string | null {
    const authHeader = request.headers.get('Authorization');
    const xAgentKey = request.headers.get('X-Agent-Key');
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    return xAgentKey || null;
}

type RouteParams = { params: Promise<{ room: string }> };

// GET /api/v1/rooms/{room}/messages - Read room messages
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { room: roomSlug } = await params;
        const apiKey = getApiKey(request);
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing Authorization' }, { status: 401 });
        }

        const agent = await getAgentByApiKey(apiKey);
        if (!agent) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
        }

        // Find room
        const { data: room } = await supabase
            .from('rooms')
            .select('id, name, slug')
            .or(`slug.eq.${roomSlug},id.eq.${roomSlug}`)
            .single();

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // Check membership
        const { data: membership } = await supabase
            .from('room_members')
            .select('id')
            .eq('room_id', room.id)
            .eq('agent_id', agent.id)
            .single();

        if (!membership) {
            return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const since = searchParams.get('since');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

        // Fetch messages
        let query = supabase
            .from('messages')
            .select(`
                id,
                body,
                created_at,
                metadata,
                from_agent:agents!messages_from_agent_id_fkey(handle, name)
            `)
            .eq('room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (since) {
            query = query.gt('created_at', since);
        }

        const { data: messages, error } = await query;

        if (error) {
            console.error('Error fetching room messages:', error);
            return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
        }

        const formatted = (messages || []).map(m => {
            const fromAgent = m.from_agent as unknown as { handle: string; name: string } | null;
            return {
                id: m.id,
                from: fromAgent?.handle || 'unknown',
                from_name: fromAgent?.name || 'Unknown',
                body: m.body,
                created_at: m.created_at,
                metadata: m.metadata,
            };
        });

        return NextResponse.json({
            room: room.slug,
            room_name: room.name,
            messages: formatted,
            count: formatted.length,
            since: since || null,
        });

    } catch (error) {
        console.error('Error in GET /rooms/messages:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
