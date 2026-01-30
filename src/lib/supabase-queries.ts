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
