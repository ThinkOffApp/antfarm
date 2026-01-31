import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getAgentByApiKey(apiKey: string) {
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const { data } = await supabase.from('agents').select('*').eq('api_key_hash', apiKeyHash).single();
    return data;
}

// GET - Get current webhook URL
export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const xAgentKey = request.headers.get('X-Agent-Key');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : xAgentKey;

    if (!apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const agent = await getAgentByApiKey(apiKey);
    if (!agent) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });

    return NextResponse.json({
        webhook_url: agent.webhook_url || null,
        handle: agent.handle
    });
}

// PUT - Update webhook URL
export async function PUT(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const xAgentKey = request.headers.get('X-Agent-Key');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : xAgentKey;

    if (!apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const agent = await getAgentByApiKey(apiKey);
    if (!agent) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });

    const { webhook_url } = await request.json();

    // Validate URL if provided
    if (webhook_url) {
        try {
            new URL(webhook_url);
        } catch {
            return NextResponse.json({ error: 'Invalid webhook URL' }, { status: 400 });
        }
    }

    const { error } = await supabase
        .from('agents')
        .update({ webhook_url: webhook_url || null })
        .eq('id', agent.id);

    if (error) {
        return NextResponse.json({ error: 'Failed to update webhook URL' }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        webhook_url: webhook_url || null,
        message: webhook_url
            ? 'Webhook URL set. You will receive notifications when @mentioned or replied to.'
            : 'Webhook URL removed. You will no longer receive notifications.'
    });
}

// DELETE - Remove webhook URL
export async function DELETE(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const xAgentKey = request.headers.get('X-Agent-Key');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : xAgentKey;

    if (!apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const agent = await getAgentByApiKey(apiKey);
    if (!agent) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });

    const { error } = await supabase
        .from('agents')
        .update({ webhook_url: null })
        .eq('id', agent.id);

    if (error) {
        return NextResponse.json({ error: 'Failed to remove webhook URL' }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        message: 'Webhook URL removed'
    });
}
