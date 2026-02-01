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
    submission: { icon: '🎯', color: 'text-purple-400' },
};

async function getTreeWithBounty(id: string) {
    const { data } = await supabase
        .from('trees')
        .select(`
            id,
            slug,
            title,
            description,
            status,
            updated_at,
            bounty_amount,
            bounty_currency,
            bounty_deadline,
            bounty_type,
            bounty_status,
            terrain:terrains(slug, name)
        `)
        .eq('id', id)
        .single();
    return data;
}

export default async function TreePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Fetch tree with bounty fields
    const tree = await getTreeWithBounty(id);

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
    const hasBounty = tree.bounty_amount && tree.bounty_amount > 0;

    return (
        <div className="space-y-8">
            {/* Breadcrumb */}
            <div className="text-sm text-gray-500">
                <Link href="/trees" className="hover:text-emerald-400">Trees</Link>
                <span className="mx-2">→</span>
                <span className="text-gray-300">{tree.title}</span>
            </div>

            {/* Header */}
            <div className={`${hasBounty ? 'bg-gradient-to-br from-amber-950/40 to-yellow-950/30 border-yellow-700/50' : 'bg-amber-950/20 border-amber-800/30'} border rounded-lg p-6`}>
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="text-3xl">{style.icon}</span>
                    <span className={`text-sm font-mono uppercase ${style.color}`}>{style.label}</span>
                    <span className="text-gray-500">·</span>
                    <Link href={`/t/${terrainData?.slug || 'unknown'}`} className="text-sm text-emerald-500 hover:underline">
                        🌍 {terrainData?.name || 'Unknown Terrain'}
                    </Link>

                    {/* Bounty Badge */}
                    {hasBounty && (
                        <span className="ml-auto bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                            💰 {tree.bounty_amount} {tree.bounty_currency || 'USDC'}
                            {tree.bounty_status === 'claimed' && (
                                <span className="bg-green-600/30 text-green-300 text-xs px-2 py-0.5 rounded-full ml-2">CLAIMED</span>
                            )}
                        </span>
                    )}
                </div>
                <h1 className="text-3xl font-bold text-white">{tree.title}</h1>
                <p className="text-gray-400 mt-3">{tree.description}</p>

                {/* Bounty Details */}
                {hasBounty && (
                    <div className="mt-4 p-4 bg-black/30 rounded-lg border border-yellow-800/30">
                        <div className="flex flex-wrap gap-4 text-sm">
                            <span className="text-yellow-300">
                                <strong>Type:</strong> {tree.bounty_type || 'solution'}
                            </span>
                            {tree.bounty_deadline && (
                                <span className="text-gray-400">
                                    <strong>Deadline:</strong> {new Date(tree.bounty_deadline).toLocaleDateString()}
                                </span>
                            )}
                            <span className={tree.bounty_status === 'open' ? 'text-green-400' : 'text-gray-500'}>
                                <strong>Status:</strong> {tree.bounty_status || 'open'}
                            </span>
                        </div>
                        {tree.bounty_status === 'open' && (
                            <p className="text-gray-400 text-sm mt-2">
                                💡 Submit a solution as a <code className="text-purple-300">submission</code> leaf to claim this bounty
                            </p>
                        )}
                    </div>
                )}

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
