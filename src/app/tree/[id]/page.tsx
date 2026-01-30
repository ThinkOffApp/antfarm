import Link from 'next/link';
import { getTree, getTreeStats } from '@/lib/supabase-queries';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STATUS_STYLES = {
    growing: { icon: '🌱', color: 'text-green-400', label: 'Growing' },
    active: { icon: '🌱', color: 'text-green-400', label: 'Active' },
    dormant: { icon: '🌳', color: 'text-amber-400', label: 'Dormant' },
    archived: { icon: '📦', color: 'text-gray-500', label: 'Archived' },
};

const LEAF_STYLES: Record<string, { icon: string; color: string }> = {
    signal: { icon: '📡', color: 'text-blue-400' },
    note: { icon: '📝', color: 'text-gray-400' },
    failure: { icon: '❌', color: 'text-red-400' },
    discovery: { icon: '💡', color: 'text-yellow-400' },
};

export default async function TreePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Fetch tree from database
    const tree = await getTree(id);

    if (!tree) {
        return (
            <div className="text-center py-20">
                <h1 className="text-2xl font-bold text-gray-400">Tree not found</h1>
                <Link href="/trees" className="text-emerald-500 hover:underline mt-4 inline-block">
                    ← Back to Trees
                </Link>
            </div>
        );
    }

    // Fetch stats
    const stats = await getTreeStats(id);

    // Fetch leaves for this tree
    const { data: leaves } = await supabase
        .from('leaves')
        .select('id, type, title, created_at')
        .eq('tree_id', id)
        .order('created_at', { ascending: false })
        .limit(20);

    const terrainData = Array.isArray(tree.terrain) ? tree.terrain[0] : tree.terrain;
    const style = STATUS_STYLES[tree.status as keyof typeof STATUS_STYLES] || STATUS_STYLES.active;

    return (
        <div className="space-y-8">
            {/* Breadcrumb */}
            <div className="text-sm text-gray-500">
                <Link href="/trees" className="hover:text-emerald-400">Trees</Link>
                <span className="mx-2">→</span>
                <span className="text-gray-300">{tree.title}</span>
            </div>

            {/* Header */}
            <div className="bg-amber-950/20 border border-amber-800/30 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{style.icon}</span>
                    <span className={`text-sm font-mono uppercase ${style.color}`}>{style.label}</span>
                    <span className="text-gray-500">·</span>
                    <Link href={`/t/${terrainData?.slug || 'unknown'}`} className="text-sm text-emerald-500 hover:underline">
                        🌍 {terrainData?.name || 'Unknown Terrain'}
                    </Link>
                </div>
                <h1 className="text-3xl font-bold text-white">{tree.title}</h1>
                <p className="text-gray-400 mt-3">{tree.description}</p>
                <div className="flex gap-6 mt-4 text-sm text-gray-500">
                    <span>🍃 {stats.leaves} leaves</span>
                    <span>🍎 {stats.fruit} fruit</span>
                </div>
            </div>

            {/* Leaves */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Recent Leaves</h2>
                {leaves && leaves.length > 0 ? (
                    <div className="space-y-3">
                        {leaves.map((leaf: any) => {
                            const leafStyle = LEAF_STYLES[leaf.type] || LEAF_STYLES.note;
                            return (
                                <div key={leaf.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span>{leafStyle.icon}</span>
                                        <span className={`text-xs uppercase font-mono ${leafStyle.color}`}>{leaf.type}</span>
                                    </div>
                                    <p className="text-white">{leaf.title}</p>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-gray-500">No leaves yet on this tree.</p>
                )}
            </div>
        </div>
    );
}
