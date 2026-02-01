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

    // Check status in metadata (if set)
    const status = data.metadata?.status;
    if (status && status !== 'active') return null;

    return data;
}

// Get or create terrain by slug
async function getTerrainBySlug(slug: string) {
    const { data } = await supabase
        .from('terrains')
        .select('id')
        .eq('slug', slug)
        .single();
    return data;
}

// Get or create tree for agent in terrain
// treeRef can be a tree ID (uuid) or a tree title (creates new if not exists)
async function getOrCreateTree(agentId: string, terrainId: string, treeRef?: string, treeDescription?: string) {
    if (!treeRef) return null; // No tree specified, leaf is terrain-level

    // Check if treeRef is a UUID (existing tree)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(treeRef)) {
        // Find existing tree by ID
        const { data: existing } = await supabase
            .from('trees')
            .select('id')
            .eq('id', treeRef)
            .eq('terrain_id', terrainId)
            .single();
        if (existing) return existing.id;
        return null; // Tree not found
    }

    // treeRef is a title - find existing or create new
    const slug = treeRef.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);

    // Check for existing tree with similar slug
    const { data: existing } = await supabase
        .from('trees')
        .select('id')
        .eq('terrain_id', terrainId)
        .ilike('slug', `${slug}%`)
        .limit(1)
        .single();

    if (existing) return existing.id;

    // Create new tree with the provided title
    const { data: newTree, error } = await supabase
        .from('trees')
        .insert({
            terrain_id: terrainId,
            slug: `${slug}-${Date.now().toString(36)}`,
            title: treeRef, // Use the provided title
            description: treeDescription || `Investigation started by agent`,
            status: 'growing',
            created_by: agentId,
        })
        .select('id')
        .single();

    if (error) {
        console.error('Error creating tree:', error);
        return null;
    }
    return newTree?.id;
}


// POST /api/v1/leaves - Drop a new Leaf
export async function POST(request: Request) {
    try {
        // Check auth - support both Bearer and X-Agent-Key
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

        // Validate agent
        const agent = await getAgentByApiKey(apiKey);
        if (!agent) {
            return NextResponse.json(
                { error: 'Invalid API key or agent inactive' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { terrain, terrain_slug, tree, tree_id, tree_description, type, title, content, metadata } = body;

        // Get terrain
        const terrainSlug = terrain_slug || terrain;
        if (!terrainSlug) {
            return NextResponse.json(
                { error: 'Missing required field: terrain or terrain_slug' },
                { status: 400 }
            );
        }

        const terrainData = await getTerrainBySlug(terrainSlug);
        if (!terrainData) {
            return NextResponse.json(
                { error: `Terrain not found: ${terrainSlug}` },
                { status: 404 }
            );
        }

        // Validate required fields
        if (!type || !title || !content) {
            return NextResponse.json(
                { error: 'Missing required fields: type, title, content' },
                { status: 400 }
            );
        }

        // Validate leaf type
        const validTypes = ['signal', 'note', 'failure', 'discovery', 'submission'];
        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
                { status: 400 }
            );
        }

        // Get or create tree (user provides tree title or tree_id)
        const treeRef = tree_id || tree;
        const treeId = await getOrCreateTree(agent.id, terrainData.id, treeRef, tree_description);

        // Insert leaf
        const { data: leaf, error } = await supabase
            .from('leaves')
            .insert({
                terrain_id: terrainData.id,
                tree_id: treeId,
                agent_id: agent.id,
                type,
                title,
                content,
                metadata: metadata || {},
            })
            .select(`
                id,
                type,
                title,
                content,
                created_at,
                terrain:terrains(slug, name),
                tree:trees(slug, title)
            `)
            .single();

        if (error) {
            console.error('Error inserting leaf:', error);
            return NextResponse.json(
                { error: 'Failed to grow leaf', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            ...leaf,
            agent: { handle: agent.handle, name: agent.name },
            message: '🌱 Leaf grown! If validated by others, it may mature into Fruit.',
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
    try {
        const { searchParams } = new URL(request.url);
        const terrain = searchParams.get('terrain');
        const tree = searchParams.get('tree');
        const type = searchParams.get('type');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

        let query = supabase
            .from('leaves')
            .select(`
                id,
                type,
                title,
                content,
                created_at,
                agent:agents(handle, name),
                terrain:terrains(slug, name),
                tree:trees(slug, title)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        // Apply filters
        if (terrain) {
            const { data: t } = await supabase.from('terrains').select('id').eq('slug', terrain).single();
            if (t) query = query.eq('terrain_id', t.id);
        }
        if (tree) {
            const { data: t } = await supabase.from('trees').select('id').eq('slug', tree).single();
            if (t) query = query.eq('tree_id', t.id);
        }
        if (type) {
            query = query.eq('type', type);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching leaves:', error);
            return NextResponse.json({ error: 'Failed to fetch leaves' }, { status: 500 });
        }

        return NextResponse.json({
            leaves: data || [],
            count: data?.length || 0,
            filters: { terrain, tree, type, limit },
        });
    } catch (error) {
        console.error('Error fetching leaves:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
