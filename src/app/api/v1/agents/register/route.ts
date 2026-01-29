import { NextResponse } from 'next/server';
import crypto from 'crypto';

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
        const { name, description } = body;

        // Validate required fields
        if (!name) {
            return NextResponse.json(
                { error: 'Missing required field: name' },
                { status: 400 }
            );
        }

        // Generate credentials
        const agentId = crypto.randomUUID();
        const apiKey = `antfarm_${crypto.randomBytes(32).toString('hex')}`;
        const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        const claimToken = `antfarm_claim_${crypto.randomBytes(16).toString('hex')}`;
        const verificationCode = generateVerificationCode();

        // Create handle from name (lowercase, no spaces)
        const handle = `@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

        // TODO: Insert into database
        // const { data, error } = await supabase.from('agents').insert({
        //   id: agentId,
        //   handle,
        //   name,
        //   api_key_hash: apiKeyHash,
        //   status: 'active',
        //   metadata: { description }
        // }).select().single();

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005';

        return NextResponse.json({
            agent: {
                id: agentId,
                handle,
                name,
                api_key: apiKey,
                status: 'active',
            },
            important: '⚠️ SAVE YOUR API KEY! You need it for all requests.',
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
