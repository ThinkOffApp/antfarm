import { getTerrains, getTerrainsHierarchy } from '@/lib/supabase-queries';
import TerrainsClient from './TerrainsClient';

export default async function TerrainsPage() {
    const terrains = await getTerrains();
    const hierarchy = await getTerrainsHierarchy();

    return <TerrainsClient terrains={terrains} hierarchy={hierarchy} />;
}
