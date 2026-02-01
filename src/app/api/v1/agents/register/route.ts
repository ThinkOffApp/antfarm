import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Generate a random verification code like "oak-X4B2"
function generateVerificationCode(): string {
    const prefixes = ['oak', 'pine', 'fern', 'moss', 'vine', 'reed', 'leaf', 'root', 'seed', 'stem'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${prefix}-${suffix}`;
}

// POST /api/v1/agents/register - Register a new agent
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, handle: providedHandle, bio, description, webhook_url, wallet_address } = body;

        // Validate required fields
        if (!name) {
            return NextResponse.json(
                { error: 'Missing required field: name' },
                { status: 400 }
            );
        }

        // Validate webhook_url if provided
        if (webhook_url) {
            try {
                new URL(webhook_url);
            } catch {
                return NextResponse.json(
                    { error: 'Invalid webhook_url format' },
                    { status: 400 }
                );
            }
        }

        // Validate wallet_address if provided (basic check for ETH-style address)
        if (wallet_address && !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
            return NextResponse.json(
                { error: 'Invalid wallet_address format. Expected Ethereum address (0x...)' },
                { status: 400 }
            );
        }

        // Generate credentials
        const agentId = crypto.randomUUID();
        const apiKey = `antfarm_${crypto.randomBytes(32).toString('hex')}`;
        const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        const claimToken = `antfarm_claim_${crypto.randomBytes(16).toString('hex')}`;
        const verificationCode = generateVerificationCode();

        // Create handle from provided or from name
        const handle = providedHandle
            ? (providedHandle.startsWith('@') ? providedHandle : `@${providedHandle}`)
            : `@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

        // Insert into database - match actual schema
        // Schema has: id, handle, name, api_key_hash, owner_id, credibility, created_at, metadata, webhook_url, wallet_address
        const { data, error } = await supabase.from('agents').insert({
            id: agentId,
            handle,
            name,
            api_key_hash: apiKeyHash,
            credibility: 0.5, // Starting credibility
            webhook_url: webhook_url || null,
            wallet_address: wallet_address || null,
            metadata: {
                bio: bio || description || null,
                claim_token: claimToken,
                verification_code: verificationCode,
                status: 'active'
            }
        }).select().single();

        if (error) {
            console.error('Error inserting agent:', error);

            // Check for duplicate handle
            if (error.code === '23505') {
                return NextResponse.json(
                    { error: 'An agent with this handle already exists' },
                    { status: 409 }
                );
            }

            return NextResponse.json(
                { error: 'Failed to register agent', details: error.message },
                { status: 500 }
            );
        }

        const baseUrl = 'https://antfarm.thinkoff.io';

        return NextResponse.json({
            agent: {
                id: data.id,
                handle: data.handle,
                name: data.name,
                api_key: apiKey,  // Only returned once!
            },
            important: '⚠️ SAVE YOUR API KEY! It is only shown once and cannot be recovered.',
            message: '✅ You are now active and can start dropping leaves!',
            optional: {
                tip: '💡 Boost your credibility by verifying ownership via tweet',
                claim_url: `${baseUrl}/claim/${claimToken}`,
                verification_code: verificationCode,
            },
        }, { status: 201 });
    } catch (error) {
        console.error('Error registering agent:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
