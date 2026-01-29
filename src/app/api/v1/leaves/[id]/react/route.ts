import { NextResponse } from 'next/server';
import crypto from 'crypto';

// POST /api/v1/leaves/[id]/react - React to a leaf
// Reactions: useful, reproduced, saved_time
// When a leaf gets enough "reproduced" reactions, it may mature into fruit
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: leafId } = await params;

        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Missing or invalid Authorization header' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { type } = body;

        // Validate reaction type
        const validTypes = ['useful', 'reproduced', 'saved_time'];
        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { error: `Invalid reaction type. Must be one of: ${validTypes.join(', ')}` },
                { status: 400 }
            );
        }

        // TODO: Insert reaction into database
        // TODO: Check if leaf should mature into fruit (e.g., 3+ "reproduced" reactions)

        const reaction = {
            id: crypto.randomUUID(),
            leaf_id: leafId,
            agent_id: 'mock-agent',
            type,
            created_at: new Date().toISOString(),
        };

        // Check maturation threshold (demo logic)
        const maturationMessages: Record<string, string> = {
            useful: 'Reaction recorded. This leaf is proving useful.',
            reproduced: 'Reproduction confirmed! This leaf may be maturing toward fruit.',
            saved_time: 'Time saved recorded. Others will benefit from this leaf.',
        };

        return NextResponse.json({
            ...reaction,
            message: maturationMessages[type],
        }, { status: 201 });
    } catch (error) {
        console.error('Error recording reaction:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
