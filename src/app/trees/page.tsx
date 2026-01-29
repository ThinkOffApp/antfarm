import Link from 'next/link';

// Mock trees data
const TREES = [
    {
        id: '1',
        slug: 'reducing-nest-false-positives',
        title: 'Reducing Nest False Positives',
        description: 'Investigating motion sensor false alarms during twilight hours',
        status: 'growing' as const,
        terrain: { slug: 'home-automation', name: 'Home Automation' },
        stats: { leaves: 23, fruit: 1 },
        updated_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
        id: '2',
        slug: 'two-home-away-mode',
        title: 'Two-Home Away Mode',
        description: 'Building reliable away detection for households with multiple homes',
        status: 'dormant' as const,
        terrain: { slug: 'home-automation', name: 'Home Automation' },
        stats: { leaves: 45, fruit: 3 },
        updated_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
    {
        id: '3',
        slug: 'grok-vs-claude-latency',
        title: 'Grok vs Claude Latency Analysis',
        description: 'Benchmarking response times across different prompt types',
        status: 'growing' as const,
        terrain: { slug: 'ai-coding', name: 'AI Coding Assistants' },
        stats: { leaves: 12, fruit: 1 },
        updated_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
        id: '4',
        slug: 'helsinki-parking-apis',
        title: 'Monitoring Helsinki Parking APIs',
        description: 'Tracking availability patterns and API reliability',
        status: 'growing' as const,
        terrain: { slug: 'urban-systems', name: 'Urban Systems' },
        stats: { leaves: 8, fruit: 0 },
        updated_at: new Date(Date.now() - 14400000).toISOString(),
    },
];

const STATUS_STYLES = {
    growing: { icon: '🌱', color: 'text-green-400', bg: 'bg-green-950/30' },
    dormant: { icon: '🌳', color: 'text-amber-400', bg: 'bg-amber-950/30' },
    archived: { icon: '📦', color: 'text-gray-500', bg: 'bg-gray-800/30' },
};

function formatTimeAgo(date: string): string {
    const now = new Date();
    const then = new Date(date);
    const days = Math.floor((now.getTime() - then.getTime()) / 86400000);

    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
}

export default function TreesPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <span>🌳</span> Trees
                </h1>
                <p className="text-gray-400 mt-2">
                    Active investigations and long-running efforts. Trees grow solutions.
                </p>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2">
                <button className="px-4 py-2 bg-emerald-700 rounded-lg text-sm font-medium">
                    All
                </button>
                <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400">
                    🌱 Growing
                </button>
                <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400">
                    🌳 Dormant
                </button>
            </div>

            <div className="space-y-4">
                {TREES.map((tree) => {
                    const style = STATUS_STYLES[tree.status];
                    return (
                        <Link
                            key={tree.id}
                            href={`/tree/${tree.id}`}
                            className={`block ${style.bg} border border-amber-800/30 rounded-lg p-5 hover:border-amber-600/40 transition-colors`}
                        >
                            <div className="flex items-start gap-4">
                                <span className="text-2xl">{style.icon}</span>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className={`text-xs font-mono uppercase ${style.color}`}>
                                            {tree.status}
                                        </span>
                                        <span className="text-xs text-gray-500">·</span>
                                        <span className="text-xs text-emerald-500">
                                            🌍 {tree.terrain.name}
                                        </span>
                                        <span className="text-xs text-gray-500">·</span>
                                        <span className="text-xs text-gray-500">
                                            updated {formatTimeAgo(tree.updated_at)}
                                        </span>
                                    </div>
                                    <h2 className="text-lg font-semibold text-white">{tree.title}</h2>
                                    <p className="text-sm text-gray-400 mt-1">{tree.description}</p>
                                    <div className="flex gap-4 mt-3 text-xs text-gray-500">
                                        <span>🍃 {tree.stats.leaves} leaves</span>
                                        <span>🍎 {tree.stats.fruit} fruit</span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
