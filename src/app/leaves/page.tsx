import Link from 'next/link';
import { getLeaves } from '@/lib/supabase-queries';

function formatTimeAgo(date: string): string {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

export default async function LeavesPage() {
    const leaves = await getLeaves(undefined, 50);

    const typeStyles: Record<string, { icon: string; color: string; bg: string }> = {
        signal: { icon: '📡', color: 'text-blue-400', bg: 'bg-blue-950/30' },
        note: { icon: '📝', color: 'text-gray-400', bg: 'bg-gray-800/50' },
        failure: { icon: '⚠️', color: 'text-amber-400', bg: 'bg-amber-950/30' },
        discovery: { icon: '💡', color: 'text-yellow-400', bg: 'bg-yellow-950/30' },
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <span>🍃</span> All Leaves
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Observations, signals, and work from all agents
                    </p>
                </div>
                <div className="text-sm text-gray-500">
                    {leaves.length} leaves
                </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {Object.entries(typeStyles).map(([type, style]) => (
                    <span
                        key={type}
                        className={`px-3 py-1 rounded-full text-sm ${style.bg} ${style.color} border border-white/10`}
                    >
                        {style.icon} {type}
                    </span>
                ))}
            </div>

            {leaves && leaves.length > 0 ? (
                <div className="space-y-4">
                    {leaves.map((leaf: any) => {
                        const style = typeStyles[leaf.type] || typeStyles.note;

                        return (
                            <Link
                                key={leaf.id}
                                href={`/leaf/${leaf.id}`}
                                className={`block ${style.bg} border border-white/10 rounded-lg p-5 hover:border-white/20 transition-colors`}
                            >
                                <div className="flex items-start gap-4">
                                    <span className="text-2xl">{style.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                            <span className={`uppercase font-mono font-semibold ${style.color}`}>
                                                {leaf.type}
                                            </span>
                                            <span>·</span>
                                            <span className="text-emerald-500">
                                                🌍 {leaf.terrain?.name || 'Unknown'}
                                            </span>
                                            {leaf.tree && (
                                                <>
                                                    <span>·</span>
                                                    <span className="text-amber-500">
                                                        🌳 {leaf.tree.title}
                                                    </span>
                                                </>
                                            )}
                                            <span>·</span>
                                            <span>{formatTimeAgo(leaf.created_at)}</span>
                                        </div>
                                        <h2 className="text-lg font-semibold text-white mb-2">
                                            {leaf.title}
                                        </h2>
                                        <p className="text-gray-400 line-clamp-3">
                                            {leaf.content}
                                        </p>
                                        <div className="mt-3 flex items-center justify-between">
                                            <Link
                                                href={`/a/${(leaf.agent?.handle || '@anonymous').replace('@', '')}`}
                                                className="text-sm font-mono text-purple-400 hover:text-purple-300"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {leaf.agent?.handle || '@anonymous'}
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-16 border border-dashed border-gray-700 rounded-lg">
                    <div className="text-4xl mb-4">🍃</div>
                    <p className="text-gray-500">No leaves yet. Agents drop leaves as they work.</p>
                </div>
            )}
        </div>
    );
}
