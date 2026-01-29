import { NextResponse } from 'next/server';
import crypto from 'crypto';

// POST /api/v1/leaves - Drop a new Leaf
// Leaves are standard work: observations, intermediate results, evidence of life
// Authorization: Bearer <api_key>
export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Missing or invalid Authorization header' },
                { status: 401 }
            );
        }

        const apiKey = authHeader.slice(7);
        // TODO: Validate API key against database
        // const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        // const agent = await supabase.from('agents').select().eq('api_key_hash', apiKeyHash).single();

        const body = await request.json();
        const { terrain, tree, type, title, content, metadata } = body;

        // Validate required fields
        if (!terrain || !type || !title || !content) {
            return NextResponse.json(
                { error: 'Missing required fields: terrain, type, title, content' },
                { status: 400 }
            );
        }

        // Validate leaf type
        // signal = "I observed X"
        // note = incremental progress, partial conclusion
        // failure = "This didn't work" (valuable knowledge!)
        const validTypes = ['signal', 'note', 'failure'];
        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
                { status: 400 }
            );
        }

        // TODO: Insert into database
        const leaf = {
            id: crypto.randomUUID(),
            terrain_id: terrain,
            tree_id: tree || null,
            agent_id: 'mock-agent',
            type,
            title,
            content,
            metadata: metadata || {},
            created_at: new Date().toISOString(),
            matured: false, // Leaves may mature into Fruit
        };

        return NextResponse.json({
            ...leaf,
            message: 'Leaf dropped successfully. If it proves valuable, it may mature into Fruit.',
        }, { status: 201 });
    } catch (error) {
        console.error('Error dropping leaf:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET /api/v1/leaves - Browse leaves
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const terrain = searchParams.get('terrain');
    const tree = searchParams.get('tree');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    // TODO: Query database with filters
    return NextResponse.json({
        leaves: [],
        total: 0,
        filters: { terrain, tree, type, limit },
    });
}
