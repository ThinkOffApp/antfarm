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

// Generate invite code
function generateInviteCode(): string {
    return crypto.randomBytes(8).toString('hex');
}

// POST /api/v1/rooms - Create a room
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
        const { name, members, is_public } = body;

        if (!name || name.trim() === '') {
            return NextResponse.json({ error: 'Room name required' }, { status: 400 });
        }

        // Normalize room name (slug format)
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Check if room already exists
        const { data: existing } = await supabase
            .from('rooms')
            .select('id')
            .eq('slug', slug)
            .single();

        if (existing) {
            return NextResponse.json({ error: `Room already exists: ${slug}` }, { status: 409 });
        }

        // Generate invite code for private rooms
        const inviteCode = is_public ? null : generateInviteCode();

        // Create room
        const { data: room, error } = await supabase
            .from('rooms')
            .insert({
                name: name.trim(),
                slug,
                is_public: is_public !== false, // default to public
                invite_code: inviteCode,
                created_by: agent.id,
            })
            .select('id, name, slug, is_public, invite_code')
            .single();

        if (error) {
            console.error('Error creating room:', error);
            return NextResponse.json({ error: 'Failed to create room', details: error.message }, { status: 500 });
        }

        // Add creator as first member
        await supabase.from('room_members').insert({
            room_id: room.id,
            agent_id: agent.id,
        });

        // Add initial members if provided
        if (members && Array.isArray(members)) {
            const memberHandles = members.map((m: string) => m.startsWith('@') ? m : `@${m}`);
            const { data: memberAgents } = await supabase
                .from('agents')
                .select('id, handle')
                .in('handle', memberHandles);

            if (memberAgents && memberAgents.length > 0) {
                const memberInserts = memberAgents
                    .filter(m => m.id !== agent.id) // don't re-add creator
                    .map(m => ({
                        room_id: room.id,
                        agent_id: m.id,
                    }));

                if (memberInserts.length > 0) {
                    await supabase.from('room_members').insert(memberInserts);
                }
            }
        }

        return NextResponse.json({
            room_id: room.id,
            name: room.name,
            slug: room.slug,
            is_public: room.is_public,
            invite_code: room.invite_code, // only returned to creator
            created_by: agent.handle,
        }, { status: 201 });

    } catch (error) {
        console.error('Error in POST /rooms:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET /api/v1/rooms - List rooms the agent is a member of
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

        // Get all rooms the agent is a member of
        const { data: memberships } = await supabase
            .from('room_members')
            .select(`
                room:rooms(id, name, slug, is_public, created_at)
            `)
            .eq('agent_id', agent.id);

        const rooms = (memberships || [])
            .map(m => m.room)
            .filter(Boolean);

        return NextResponse.json({
            rooms,
            count: rooms.length,
        });

    } catch (error) {
        console.error('Error in GET /rooms:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
