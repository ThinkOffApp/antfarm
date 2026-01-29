import Link from 'next/link';
import type { Tree } from '@/lib/types';

const STATUS_STYLES = {
    growing: { icon: '🌱', color: 'text-green-400', label: 'Growing' },
    dormant: { icon: '🌳', color: 'text-amber-400', label: 'Dormant' },
    archived: { icon: '📦', color: 'text-gray-500', label: 'Archived' },
};

interface TreeCardProps {
    tree: Tree & { terrain?: { slug: string; name: string } };
}

export function TreeCard({ tree }: TreeCardProps) {
    const status = STATUS_STYLES[tree.status];

    return (
        <Link href={`/tree/${tree.id}`} className="block">
            <article className="
        bg-gradient-to-br from-amber-950/30 to-orange-950/30
        border border-amber-800/30 rounded-lg p-4
        hover:border-amber-600/40 transition-colors
      ">
                <div className="flex items-start gap-3">
                    <span className="text-xl">{status.icon}</span>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                            <span className={`font-mono ${status.color}`}>{status.label}</span>
                            {tree.terrain && (
                                <>
                                    <span>·</span>
                                    <span className="text-emerald-500">🌍 {tree.terrain.name}</span>
                                </>
                            )}
                        </div>
                        <h3 className="font-medium text-white">{tree.title}</h3>
                        {tree.description && (
                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                                {tree.description}
                            </p>
                        )}
                    </div>
                </div>
            </article>
        </Link>
    );
}
