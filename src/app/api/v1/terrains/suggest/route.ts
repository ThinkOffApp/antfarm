import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/v1/terrains/suggest - Suggest a new terrain (goes to pending status)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, description, parent_id } = body;

        if (!name || !description) {
            return NextResponse.json(
                { error: 'Name and description are required' },
                { status: 400 }
            );
        }

        // Generate slug from name
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        // Check if slug already exists
        const { data: existing } = await supabase
            .from('terrains')
            .select('id')
            .eq('slug', slug)
            .single();

        if (existing) {
            return NextResponse.json(
                { error: 'A terrain with this name already exists' },
                { status: 409 }
            );
        }

        // Insert as pending
        const { data, error } = await supabase
            .from('terrains')
            .insert({
                name,
                slug,
                description,
                parent_id: parent_id || null,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating terrain suggestion:', error);
            return NextResponse.json(
                { error: 'Failed to submit suggestion' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: 'Terrain suggestion submitted for review',
            terrain: data
        }, { status: 201 });

    } catch (error) {
        console.error('Error in terrain suggestion:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET /api/v1/terrains/suggest - Get pending terrain suggestions (admin only)
export async function GET(request: NextRequest) {
    try {
        // TODO: Add admin authentication check

        const { data, error } = await supabase
            .from('terrains')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json(
                { error: 'Failed to fetch suggestions' },
                { status: 500 }
            );
        }

        return NextResponse.json({ suggestions: data });

    } catch (error) {
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
