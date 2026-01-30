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

interface RouteParams { params: Promise<{ id: string }>; }

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
