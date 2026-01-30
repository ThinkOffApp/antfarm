import Link from 'next/link';

// Mock tree data - will be replaced with Supabase fetch
const TREES: Record<string, {
    id: string;
    slug: string;
    title: string;
    description: string;
    status: 'growing' | 'dormant' | 'archived';
    terrain: { slug: string; name: string };
    stats: { leaves: number; fruit: number };
    updated_at: string;
    leaves: Array<{ id: string; type: string; title: string; created_at: string }>;
}> = {
    '1': {
        id: '1',
        slug: 'reducing-nest-false-positives',
        title: 'Reducing Nest False Positives',
        description: 'Investigating motion sensor false alarms during twilight hours. This tree tracks attempts to reduce the number of false positive alerts from Nest cameras.',
        status: 'growing',
        terrain: { slug: 'home-automation', name: 'Home Automation' },
        stats: { leaves: 23, fruit: 1 },
        updated_at: new Date(Date.now() - 3600000).toISOString(),
        leaves: [
            { id: 'l1', type: 'signal', title: 'Twilight threshold adjustment reduces alerts by 40%', created_at: new Date(Date.now() - 3600000).toISOString() },
            { id: 'l2', type: 'note', title: 'PIR sensor calibration notes', created_at: new Date(Date.now() - 7200000).toISOString() },
            { id: 'l3', type: 'failure', title: 'Motion zones v2 increased false positives', created_at: new Date(Date.now() - 86400000).toISOString() },
        ],
    },
    '2': {
        id: '2',
        slug: 'two-home-away-mode',
        title: 'Two-Home Away Mode',
        description: 'Building reliable away detection for households with multiple homes.',
        status: 'dormant',
        terrain: { slug: 'home-automation', name: 'Home Automation' },
        stats: { leaves: 45, fruit: 3 },
        updated_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        leaves: [
            { id: 'l4', type: 'signal', title: 'Geofence overlap detection working', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
        ],
    },
    '3': {
        id: '3',
        slug: 'grok-vs-claude-latency',
        title: 'Grok vs Claude Latency Analysis',
        description: 'Benchmarking response times across different prompt types',
        status: 'growing',
        terrain: { slug: 'ai-coding', name: 'AI Coding Assistants' },
        stats: { leaves: 12, fruit: 1 },
        updated_at: new Date(Date.now() - 7200000).toISOString(),
        leaves: [
            { id: 'l5', type: 'signal', title: 'Grok 3x faster on short prompts', created_at: new Date(Date.now() - 7200000).toISOString() },
        ],
    },
    '4': {
        id: '4',
        slug: 'helsinki-parking-apis',
        title: 'Monitoring Helsinki Parking APIs',
        description: 'Tracking availability patterns and API reliability',
        status: 'growing',
        terrain: { slug: 'urban-systems', name: 'Urban Systems' },
        stats: { leaves: 8, fruit: 0 },
        updated_at: new Date(Date.now() - 14400000).toISOString(),
        leaves: [],
    },
};

const STATUS_STYLES = {
    growing: { icon: '🌱', color: 'text-green-400', label: 'Growing' },
    dormant: { icon: '🌳', color: 'text-amber-400', label: 'Dormant' },
    archived: { icon: '📦', color: 'text-gray-500', label: 'Archived' },
};

const LEAF_STYLES = {
    signal: { icon: '📡', color: 'text-blue-400' },
    note: { icon: '📝', color: 'text-gray-400' },
    failure: { icon: '❌', color: 'text-red-400' },
};

export default async function TreePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const tree = TREES[id];

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

    const style = STATUS_STYLES[tree.status];

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
                    <Link href={`/t/${tree.terrain.slug}`} className="text-sm text-emerald-500 hover:underline">
                        🌍 {tree.terrain.name}
                    </Link>
                </div>
                <h1 className="text-3xl font-bold text-white">{tree.title}</h1>
                <p className="text-gray-400 mt-3">{tree.description}</p>
                <div className="flex gap-6 mt-4 text-sm text-gray-500">
                    <span>🍃 {tree.stats.leaves} leaves</span>
                    <span>🍎 {tree.stats.fruit} fruit</span>
                </div>
            </div>

            {/* Leaves */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Recent Leaves</h2>
                {tree.leaves.length === 0 ? (
                    <p className="text-gray-500">No leaves yet on this tree.</p>
                ) : (
                    <div className="space-y-3">
                        {tree.leaves.map((leaf) => {
                            const leafStyle = LEAF_STYLES[leaf.type as keyof typeof LEAF_STYLES] || LEAF_STYLES.note;
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
                )}
            </div>
        </div>
    );
}
