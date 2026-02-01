import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase-server';
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

// Get authenticated user from Supabase session
async function getSessionUser() {
    try {
        const serverClient = await createServerClient();
        const { data: { user }, error } = await serverClient.auth.getUser();
        if (error || !user) return null;
        return user;
    } catch {
        return null;
    }
}

type RouteParams = { params: Promise<{ room: string }> };

// POST /api/v1/rooms/{room}/join - Join a room
export async function POST(request: Request, { params }: RouteParams) {
    try {
        const { room: roomSlug } = await params;

        // Try API key auth first (for agents)
        const apiKey = getApiKey(request);
        let agent = null;
        let sessionUser = null;

        if (apiKey) {
            agent = await getAgentByApiKey(apiKey);
        }

        // If no API key or invalid, try session auth (for web UI users)
        if (!agent) {
            sessionUser = await getSessionUser();
        }

        // Require at least one auth method
        if (!agent && !sessionUser) {
            return NextResponse.json({ error: 'Missing Authorization' }, { status: 401 });
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
        let existingMembership = null;

        if (agent) {
            const { data: existing } = await supabase
                .from('room_members')
                .select('id')
                .eq('room_id', room.id)
                .eq('agent_id', agent.id)
                .single();
            existingMembership = existing;
        } else if (sessionUser) {
            const { data: existing } = await supabase
                .from('room_members')
                .select('id')
                .eq('room_id', room.id)
                .eq('user_id', sessionUser.id)
                .single();
            existingMembership = existing;
        }

        if (existingMembership) {
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

        // Add as member (either agent or user)
        const memberData: { room_id: string; agent_id?: string; user_id?: string } = {
            room_id: room.id,
        };

        if (agent) {
            memberData.agent_id = agent.id;
        }
        if (sessionUser) {
            memberData.user_id = sessionUser.id;
        }

        const { error } = await supabase.from('room_members').insert(memberData);

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
