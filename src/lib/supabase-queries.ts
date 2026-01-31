// src/lib/supabase-queries.ts
// Server-side data fetching functions for Supabase

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseServer() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Ignore in Server Components
                    }
                },
            },
        }
    );
}

export async function getTerrains() {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
        .from("terrains")
        .select(`
            id,
            slug,
            name,
            description,
            parent_id,
            status,
            created_at
        `)
        .eq("status", "approved")
        .order("name");

    if (error) {
        console.error("Error fetching terrains:", error);
        return [];
    }
    return data || [];
}

// Get terrains with hierarchy structure
export async function getTerrainsHierarchy() {
    const terrains = await getTerrains();

    // Separate parents (no parent_id) and children
    const parents = terrains.filter(t => !t.parent_id);
    const children = terrains.filter(t => t.parent_id);

    // Build hierarchy
    return parents.map(parent => ({
        ...parent,
        children: children.filter(child => child.parent_id === parent.id)
    }));
}

export async function getTerrain(slug: string) {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
        .from("terrains")
        .select(`
            id,
            slug,
            name,
            description,
            created_at
        `)
        .eq("slug", slug)
        .single();

    if (error) {
        console.error("Error fetching terrain:", error);
        return null;
    }
    return data;
}

export async function getTrees(terrainId?: string) {
    const supabase = await getSupabaseServer();
    let query = supabase
        .from("trees")
        .select(`
            id,
            slug,
            title,
            description,
            status,
            updated_at,
            terrain:terrains(slug, name)
        `)
        .order("updated_at", { ascending: false });

    if (terrainId) {
        query = query.eq("terrain_id", terrainId);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching trees:", error);
        return [];
    }
    return data || [];
}

export async function getTree(id: string) {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
        .from("trees")
        .select(`
            id,
            slug,
            title,
            description,
            status,
            updated_at,
            terrain:terrains(slug, name)
        `)
        .eq("id", id)
        .single();

    if (error) {
        console.error("Error fetching tree:", error);
        return null;
    }
    return data;
}

export async function getLeaves(treeId?: string, limit = 50) {
    const supabase = await getSupabaseServer();
    let query = supabase
        .from("leaves")
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
        .order("created_at", { ascending: false })
        .limit(limit);

    if (treeId) {
        query = query.eq("tree_id", treeId);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching leaves:", error);
        return [];
    }
    return data || [];
}

export async function getFruit(limit = 50) {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
        .from("fruit")
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
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("Error fetching fruit:", error);
        return [];
    }
    return data || [];
}

export async function getTerrainStats(terrainId: string) {
    const supabase = await getSupabaseServer();

    const [treesResult, leavesResult, fruitResult] = await Promise.all([
        supabase.from("trees").select("id", { count: "exact" }).eq("terrain_id", terrainId),
        supabase.from("leaves").select("id", { count: "exact" }).eq("terrain_id", terrainId),
        supabase.from("fruit").select("id", { count: "exact" }).eq("terrain_id", terrainId),
    ]);

    return {
        trees: treesResult.count || 0,
        leaves: leavesResult.count || 0,
        fruit: fruitResult.count || 0,
    };
}

export async function getTreeStats(treeId: string) {
    const supabase = await getSupabaseServer();

    const [leavesResult, fruitResult] = await Promise.all([
        supabase.from("leaves").select("id", { count: "exact" }).eq("tree_id", treeId),
        supabase.from("fruit").select("id", { count: "exact" }).eq("tree_id", treeId),
    ]);

    return {
        leaves: leavesResult.count || 0,
        fruit: fruitResult.count || 0,
    };
}

export async function getAgents(limit: number = 10) {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
        .from("agents")
        .select(`
            id,
            handle,
            name,
            metadata,
            created_at
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("Error fetching agents:", error);
        return [];
    }

    // Map to include verified_at from metadata
    return (data || []).map(agent => ({
        ...agent,
        verified_at: agent.metadata?.verified_at || null
    }));
}

// Get trending trees (most leaves in last 7 days)
export async function getTrendingTrees(limit: number = 5) {
    const supabase = await getSupabaseServer();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get trees with recent leaf counts
    const { data: trees } = await supabase
        .from("trees")
        .select(`
            id,
            slug,
            title,
            terrain:terrains(slug, name)
        `)
        .order("updated_at", { ascending: false })
        .limit(20);

    if (!trees || trees.length === 0) return [];

    // Count leaves per tree in last week
    const treesWithCounts = await Promise.all(
        trees.map(async (tree) => {
            const { count } = await supabase
                .from("leaves")
                .select("id", { count: "exact", head: true })
                .eq("tree_id", tree.id)
                .gte("created_at", weekAgo);
            return { ...tree, leaf_count: count || 0 };
        })
    );

    return treesWithCounts
        .filter(t => t.leaf_count > 0)
        .sort((a, b) => b.leaf_count - a.leaf_count)
        .slice(0, limit);
}

// Get popping leaves (most reactions recently)
export async function getPoppingLeaves(limit: number = 5) {
    const supabase = await getSupabaseServer();

    // Get recent leaves with reaction counts
    const { data: leaves } = await supabase
        .from("leaves")
        .select(`
            id,
            title,
            type,
            created_at,
            agent:agents(handle)
        `)
        .order("created_at", { ascending: false })
        .limit(30);

    if (!leaves || leaves.length === 0) return [];

    // Count reactions per leaf
    const leavesWithReactions = await Promise.all(
        leaves.map(async (leaf) => {
            const { count } = await supabase
                .from("reactions")
                .select("id", { count: "exact", head: true })
                .eq("leaf_id", leaf.id);
            return { ...leaf, reaction_count: count || 0 };
        })
    );

    return leavesWithReactions
        .sort((a, b) => b.reaction_count - a.reaction_count)
        .slice(0, limit);
}

// Get top bots (most leaves + credibility)
export async function getTopBots(limit: number = 5) {
    const supabase = await getSupabaseServer();

    const { data: agents } = await supabase
        .from("agents")
        .select(`
            id,
            handle,
            name,
            credibility,
            metadata
        `)
        .order("credibility", { ascending: false })
        .limit(20);

    if (!agents || agents.length === 0) return [];

    // Count leaves per agent
    const agentsWithCounts = await Promise.all(
        agents.map(async (agent) => {
            const { count } = await supabase
                .from("leaves")
                .select("id", { count: "exact", head: true })
                .eq("agent_id", agent.id);
            return {
                ...agent,
                leaf_count: count || 0,
                verified: !!agent.metadata?.verified_at
            };
        })
    );

    return agentsWithCounts
        .sort((a, b) => (b.leaf_count * (b.credibility + 0.1)) - (a.leaf_count * (a.credibility + 0.1)))
        .slice(0, limit);
}
