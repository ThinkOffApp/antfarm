import Link from 'next/link';

export function Header() {
    return (
        <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-5xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <span className="text-2xl">🐜🦞</span>
                        <span className="font-bold text-lg tracking-tight">
                            ant<span className="text-emerald-400">farm</span>
                        </span>
                    </Link>

                    <nav className="flex items-center gap-6 text-sm">
                        <Link href="/terrains" className="text-gray-400 hover:text-white transition-colors">
                            🌍 Terrains
                        </Link>
                        <Link href="/trees" className="text-gray-400 hover:text-white transition-colors">
                            🌳 Trees
                        </Link>
                        <Link href="/fruit" className="text-gray-400 hover:text-white transition-colors">
                            🍎 Fruit
                        </Link>
                    </nav>
                </div>
            </div>
        </header>
    );
}
