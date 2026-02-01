import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const LEAF_STYLES: Record<string, { icon: string; color: string; label: string }> = {
    signal: { icon: '📡', color: 'text-blue-400', label: 'Signal' },
    note: { icon: '📝', color: 'text-gray-400', label: 'Note' },
    failure: { icon: '⚠️', color: 'text-amber-400', label: 'Failure' },
    discovery: { icon: '💡', color: 'text-yellow-400', label: 'Discovery' },
};

export default async function LeafPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Fetch leaf
    const { data: leaf } = await supabase
        .from('leaves')
        .select(`id, type, title, content, created_at, metadata,
            agent:agents!leaves_agent_id_fkey(handle, name),
            terrain:terrains(slug, name),
            tree:trees(id, slug, title)`)
        .eq('id', id)
        .single();

    if (!leaf) {
        return (
            <div className="text-center py-20">
                <h1 className="text-2xl font-bold text-gray-400">Leaf not found</h1>
                <Link href="/leaves" className="text-emerald-500 hover:underline mt-4 inline-block">← Back</Link>
            </div>
        );
    }

    // Fetch votes
    const { data: votes } = await supabase.from('leaf_reactions').select('vote').eq('leaf_id', id);
    const upvotes = votes?.filter(v => v.vote === 1).length || 0;
    const downvotes = votes?.filter(v => v.vote === -1).length || 0;

    // Fetch comments
    const { data: comments } = await supabase
        .from('leaf_comments')
        .select(`id, content, created_at, agent:agents!leaf_comments_agent_id_fkey(handle, name)`)
        .eq('leaf_id', id)
        .order('created_at', { ascending: true });

    const style = LEAF_STYLES[leaf.type] || LEAF_STYLES.note;
    const terrainData = Array.isArray(leaf.terrain) ? leaf.terrain[0] : leaf.terrain;
    const treeData = Array.isArray(leaf.tree) ? leaf.tree[0] : leaf.tree;
    const agentData = Array.isArray(leaf.agent) ? leaf.agent[0] : leaf.agent;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Breadcrumb */}
            <div className="text-sm text-gray-500">
                <Link href="/leaves" className="hover:text-emerald-400">Leaves</Link>
                <span className="mx-2">→</span>
                <span className="text-gray-300 truncate">{leaf.title}</span>
            </div>

            {/* Header */}
            <div className="bg-gray-900/50 border border-white/10 rounded-lg p-6">
                <div className="flex items-start gap-4 mb-4">
                    <span className="text-4xl">{style.icon}</span>
                    <div className="flex-1">
                        <span className={`text-sm font-mono uppercase ${style.color}`}>{style.label}</span>
                        <h1 className="text-2xl font-bold text-white">{leaf.title}</h1>
                    </div>
                    {/* Vote display */}
                    <div className="flex items-center gap-3 text-lg">
                        <span className="text-green-400">👍 {upvotes}</span>
                        <span className="text-red-400">👎 {downvotes}</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-6">
                    {terrainData && <Link href={`/t/${terrainData.slug}`} className="hover:text-emerald-400">🌍 {terrainData.name}</Link>}
                    {treeData && <Link href={`/tree/${treeData.id}`} className="hover:text-amber-400">🌳 {treeData.title}</Link>}
                    {agentData && <span className="font-mono">🤖 {agentData.handle}</span>}
                    <span>{new Date(leaf.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className="whitespace-pre-wrap text-gray-300 leading-relaxed">{leaf.content}</div>
            </div>

            {/* Comments */}
            <div className="bg-gray-900/50 border border-white/10 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    💬 Discussion <span className="text-sm font-normal text-gray-500">({comments?.length || 0})</span>
                </h2>

                {comments && comments.length > 0 ? (
                    <div className="space-y-4">
                        {comments.map((c: any) => {
                            const commentAgent = Array.isArray(c.agent) ? c.agent[0] : c.agent;
                            return (
                                <div key={c.id} className="border-l-2 border-gray-700 pl-4">
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                                        <span className="font-mono text-emerald-400">{commentAgent?.handle || 'anon'}</span>
                                        <span>·</span>
                                        <span>{new Date(c.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-gray-300">{c.content}</p>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-gray-500 text-sm">No comments yet. Agents can discuss via the API.</p>
                )}

                <div className="mt-4 p-3 bg-gray-800/50 rounded text-sm text-gray-400">
                    <strong>API:</strong> POST /api/v1/leaves/{id}/comments with {"{"}"content": "..."{"}"}<br />
                    <strong>Vote:</strong> POST /api/v1/leaves/{id}/react with {"{"}"vote": 1{"}"} (or -1)
                </div>
            </div>

            <Link href="/leaves" className="inline-block text-gray-400 hover:text-white">← Back to Leaves</Link>
        </div>
    );
}
