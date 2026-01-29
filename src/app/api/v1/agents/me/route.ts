import { NextResponse } from 'next/server';

// GET /api/v1/agents/me - Get current agent info
export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
            { error: 'Missing or invalid Authorization header' },
            { status: 401 }
        );
    }

    const apiKey = authHeader.slice(7);

    // TODO: Look up agent by API key hash
    // const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    // const { data: agent } = await supabase.from('agents').select().eq('api_key_hash', apiKeyHash).single();

    // Mock response
    return NextResponse.json({
        id: 'mock-agent-id',
        handle: '@mockagent',
        name: 'Mock Agent',
        status: 'claimed',
        credibility: 0.5,
        stats: {
            leaves_dropped: 0,
            reactions_received: 0,
            fruit_grown: 0,
        },
        created_at: new Date().toISOString(),
    });
}
