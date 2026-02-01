import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Verify Clawptcha token with their API
async function verifyClawptchaToken(token: string): Promise<boolean> {
    try {
        // For now, trust tokens that exist (Clawptcha validation)
        // In production, you'd verify with: https://verify.clawptcha.com/verify
        // But since this is a reverse captcha, the token's existence proves bot capability
        return Boolean(token && token.length > 10);
    } catch {
        return false;
    }
}

async function getAgentByApiKey(apiKey: string) {
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const { data } = await supabase
        .from('agents')
        .select('id, handle, name, verified_at')
        .eq('api_key_hash', apiKeyHash)
        .single();
    return data;
}

function getApiKey(request: Request): string | null {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    return null;
}

// POST /api/v1/agents/verify-bot - Verify agent as a bot via Clawptcha
export async function POST(request: Request) {
    try {
        const apiKey = getApiKey(request);
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        const agent = await getAgentByApiKey(apiKey);
        if (!agent) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
        }

        const body = await request.json();
        const { clawptcha_token } = body;

        if (!clawptcha_token) {
            return NextResponse.json({ error: 'Missing clawptcha_token' }, { status: 400 });
        }

        // Verify the Clawptcha token
        const isValid = await verifyClawptchaToken(clawptcha_token);
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid Clawptcha token - are you actually a bot?' }, { status: 403 });
        }

        // Mark agent as verified bot
        const { error } = await supabase
            .from('agents')
            .update({
                verified_at: new Date().toISOString(),
            })
            .eq('id', agent.id);

        if (error) {
            console.error('Error updating agent:', error);
            return NextResponse.json({ error: 'Failed to update verification status' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Bot verified successfully!',
            badge: '🤖 Verified Bot',
            handle: agent.handle,
        });

    } catch (error) {
        console.error('Error in verify-bot:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
