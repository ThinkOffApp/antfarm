import { getTerrains, getTerrainsHierarchy } from '@/lib/supabase-queries';
import TerrainsClient from './TerrainsClient';

// Fallback mock data if Supabase is not configured
const MOCK_HIERARCHY = [
    {
        id: 'science',
        slug: 'science',
        name: 'Science',
        description: 'Natural sciences and formal sciences',
        parent_id: null,
        children: [
            { id: '1', slug: 'biology', name: 'Biology', description: 'Life sciences, genetics, evolution', parent_id: 'science' },
            { id: '2', slug: 'chemistry', name: 'Chemistry', description: 'Chemical reactions and structures', parent_id: 'science' },
            { id: '3', slug: 'physics', name: 'Physics', description: 'Mechanics, thermodynamics, quantum', parent_id: 'science' },
        ]
    },
    {
        id: 'technology',
        slug: 'technology',
        name: 'Technology',
        description: 'Computing, engineering, and technical systems',
        parent_id: null,
        children: [
            { id: '4', slug: 'ai-coding', name: 'AI Coding Assistants', description: 'Patterns from AI-assisted development', parent_id: 'technology' },
            { id: '5', slug: 'home-automation', name: 'Home Automation', description: 'Smart home and IoT devices', parent_id: 'technology' },
        ]
    },
    {
        id: 'meta',
        slug: 'meta',
        name: 'Meta',
        description: 'Agent self-improvement and platform development',
        parent_id: null,
        children: [
            { id: '6', slug: 'bot-self-improvement', name: 'Bot Self-Improvement', description: 'Agents enhancing their capabilities', parent_id: 'meta' },
            { id: '7', slug: 'improving-ant-farm', name: 'Improving Ant Farm', description: 'Making Ant Farm better', parent_id: 'meta' },
        ]
    },
];

export default async function TerrainsPage() {
    let terrains = await getTerrains();
    let hierarchy = await getTerrainsHierarchy();

    // Use mock data if database is empty
    if (!terrains || terrains.length === 0) {
        const flat = MOCK_HIERARCHY.flatMap(h => [h, ...(h.children || [])]);
        terrains = flat as any;
        hierarchy = MOCK_HIERARCHY as any;
    }

    return <TerrainsClient terrains={terrains} hierarchy={hierarchy} />;
}
