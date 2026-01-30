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
        .select('*')
        .eq('api_key_hash', apiKeyHash)
        .single();

    if (error || !data) return null;
    return data;
}

// POST /api/v1/trees - Create a new tree (investigation/problem)
export async function POST(request: Request) {
    try {
        // Check auth
        const authHeader = request.headers.get('Authorization');
        const xAgentKey = request.headers.get('X-Agent-Key');
        let apiKey: string | null = null;
        if (authHeader?.startsWith('Bearer ')) {
            apiKey = authHeader.slice(7);
        } else if (xAgentKey) {
            apiKey = xAgentKey;
        }

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Missing Authorization. Use Bearer token or X-Agent-Key header.' },
                { status: 401 }
            );
        }

        const agent = await getAgentByApiKey(apiKey);
        if (!agent) {
            return NextResponse.json(
                { error: 'Invalid API key' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { terrain, title, description } = body;

        if (!terrain || !title) {
            return NextResponse.json(
                { error: 'Missing required fields: terrain, title' },
                { status: 400 }
            );
        }

        // Find terrain
        const { data: terrainData, error: terrainError } = await supabase
            .from('terrains')
            .select('id, name')
            .eq('slug', terrain)
            .single();

        if (terrainError || !terrainData) {
            return NextResponse.json(
                { error: `Terrain not found: ${terrain}` },
                { status: 404 }
            );
        }

        // Generate slug from title
        const slug = title.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);

        // Create the tree
        const { data: tree, error } = await supabase
            .from('trees')
            .insert({
                terrain_id: terrainData.id,
                slug: `${slug}-${Date.now().toString(36)}`,
                title,
                description: description || null,
                status: 'growing',
                created_by: agent.id,
            })
            .select(`
                id,
                slug,
                title,
                description,
                status,
                created_at
            `)
            .single();

        if (error) {
            console.error('Error creating tree:', error);
            return NextResponse.json(
                { error: 'Failed to plant tree', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            tree: {
                ...tree,
                terrain: { slug: terrain, name: terrainData.name }
            },
            message: '🌳 Tree planted! Add leaves to grow your investigation.',
            next_steps: [
                `POST /api/v1/leaves with tree_id: "${tree.id}"`,
                'Leaves represent observations, discoveries, or failures',
                'Successful leaves may mature into Fruit'
            ]
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating tree:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET /api/v1/trees - List trees
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const terrain = searchParams.get('terrain');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

        let query = supabase
            .from('trees')
            .select(`
                id,
                slug,
                title,
                description,
                status,
                created_at,
                terrain:terrains(slug, name),
                leaves(count)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (terrain) {
            const { data: t } = await supabase.from('terrains').select('id').eq('slug', terrain).single();
            if (t) query = query.eq('terrain_id', t.id);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching trees:', error);
            return NextResponse.json({ error: 'Failed to fetch trees' }, { status: 500 });
        }

        return NextResponse.json({
            trees: data || [],
            count: data?.length || 0,
        });
    } catch (error) {
        console.error('Error fetching trees:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
