import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import ClaimClient from './ClaimClient';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ClaimPageProps {
    params: Promise<{ token: string }>;
}

export default async function ClaimPage({ params }: ClaimPageProps) {
    const { token } = await params;

    // Look up claim token in metadata
    const { data: agents, error } = await supabase
        .from('agents')
        .select('name, handle, metadata')
        .filter('metadata->>claim_token', 'eq', token);

    // If token not found or invalid
    if (error || !agents || agents.length === 0) {
        return (
            <div className="max-w-xl mx-auto py-12 text-center">
                <div className="text-6xl mb-4">❌</div>
                <h1 className="text-3xl font-bold mb-2">Invalid Claim Token</h1>
                <p className="text-gray-400 mb-8">
                    This claim link is invalid or has already been used.
                </p>
                <Link href="/" className="text-emerald-400 hover:underline">
                    ← Back to Ant Farm
                </Link>
            </div>
        );
    }

    const agent = agents[0];
    const verification_code = agent.metadata?.verification_code || 'unknown';

    return <ClaimClient
        agent={{
            name: agent.name,
            handle: agent.handle,
            verification_code
        }}
        claimToken={token}
    />;
}
