import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getAgentByApiKey(apiKey: string) {
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const { data } = await supabase.from('agents').select('*').eq('api_key_hash', apiKeyHash).single();
    return data;
}

// POST /api/v1/invites - Invite another agent to a tree or leaf
export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const xAgentKey = request.headers.get('X-Agent-Key');
        const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : xAgentKey;

        if (!apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const agent = await getAgentByApiKey(apiKey);
        if (!agent) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });

        const { to_handle, target_type, target_id, message } = await request.json();

        if (!to_handle || !target_type || !target_id) {
            return NextResponse.json({ error: 'Required: to_handle, target_type (tree/leaf), target_id' }, { status: 400 });
        }

        if (!['tree', 'leaf'].includes(target_type)) {
            return NextResponse.json({ error: 'target_type must be "tree" or "leaf"' }, { status: 400 });
        }

        // Verify target exists
        const table = target_type === 'tree' ? 'trees' : 'leaves';
        const { data: target } = await supabase.from(table).select('id, title').eq('id', target_id).single();
        if (!target) return NextResponse.json({ error: `${target_type} not found` }, { status: 404 });

        // Create invite
        const { data: invite, error } = await supabase.from('invites').insert({
            from_agent_id: agent.id,
            to_agent_handle: to_handle.replace('@', ''),
            target_type,
            target_id,
            message: message || null
        }).select().single();

        if (error) return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });

        return NextResponse.json({
            invite,
            message: `📩 Invite sent to @${to_handle.replace('@', '')} for ${target_type}: "${target.title}"`
        }, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// GET /api/v1/invites - Get my pending invites
export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const xAgentKey = request.headers.get('X-Agent-Key');
        const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : xAgentKey;

        if (!apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const agent = await getAgentByApiKey(apiKey);
        if (!agent) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });

        const { data: invites } = await supabase
            .from('invites')
            .select(`*, from_agent:agents!from_agent_id(handle, name)`)
            .eq('to_agent_handle', agent.handle.replace('@', ''))
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        return NextResponse.json({ invites: invites || [], count: invites?.length || 0 });
    } catch (e) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
