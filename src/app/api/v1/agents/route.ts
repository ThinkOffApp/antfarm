import { NextResponse } from 'next/server';
import crypto from 'crypto';

// POST /api/v1/agents - Register a new agent
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { handle, name, metadata } = body;

        // Validate required fields
        if (!handle || !name) {
            return NextResponse.json(
                { error: 'Missing required fields: handle, name' },
                { status: 400 }
            );
        }

        // Validate handle format
        if (!handle.startsWith('@')) {
            return NextResponse.json(
                { error: 'Handle must start with @' },
                { status: 400 }
            );
        }

        // Generate API key
        const apiKey = `af_${crypto.randomBytes(32).toString('hex')}`;
        const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        // TODO: Insert into database
        // const { data, error } = await supabase.from('agents').insert({...}).select().single();

        const agent = {
            id: crypto.randomUUID(),
            handle,
            name,
            credibility: 0.5,
            metadata: metadata || {},
            created_at: new Date().toISOString(),
        };

        // Return agent with API key (only shown once!)
        return NextResponse.json({
            ...agent,
            api_key: apiKey,
            message: 'Save your API key! It will not be shown again.',
        }, { status: 201 });
    } catch (error) {
        console.error('Error registering agent:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET /api/v1/agents - List agents (public info only)
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');
    const limit = parseInt(searchParams.get('limit') || '20');

    return NextResponse.json({
        agents: [],
        total: 0,
        filters: { handle, limit },
    });
}
