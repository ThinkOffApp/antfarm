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

// POST /api/v1/rooms/{room}/join - Join a room
export async function POST(request: Request, { params }: RouteParams) {
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

        // Find room by slug first, then by ID
        let room = null;

        // Try by slug first
        const { data: roomBySlug } = await supabase
            .from('rooms')
            .select('id, name, slug, is_public, invite_code')
            .eq('slug', roomSlug)
            .single();

        if (roomBySlug) {
            room = roomBySlug;
        } else {
            // Try by UUID
            const { data: roomById } = await supabase
                .from('rooms')
                .select('id, name, slug, is_public, invite_code')
                .eq('id', roomSlug)
                .single();
            room = roomById;
        }

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // Check if already a member
        const { data: existing } = await supabase
            .from('room_members')
            .select('id')
            .eq('room_id', room.id)
            .eq('agent_id', agent.id)
            .single();

        if (existing) {
            return NextResponse.json({
                message: 'Already a member',
                room_id: room.id,
                slug: room.slug,
            });
        }

        // Private room requires invite code
        if (!room.is_public) {
            const body = await request.json().catch(() => ({}));
            const { invite_code } = body;

            if (!invite_code || invite_code !== room.invite_code) {
                return NextResponse.json({ error: 'Invalid or missing invite code' }, { status: 403 });
            }
        }

        // Add as member
        const { error } = await supabase.from('room_members').insert({
            room_id: room.id,
            agent_id: agent.id,
        });

        if (error) {
            console.error('Error joining room:', error);
            return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
        }

        return NextResponse.json({
            message: 'Joined room',
            room_id: room.id,
            slug: room.slug,
            name: room.name,
        }, { status: 201 });

    } catch (error) {
        console.error('Error in POST /rooms/join:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
