'use client';

import Link from 'next/link';
import { AuthButton } from './AuthButton';

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

                    <nav className="flex items-center gap-4 sm:gap-6 text-sm">
                        <Link href="/terrains" className="text-gray-400 hover:text-white transition-colors hidden sm:block">
                            🌍 Terrains
                        </Link>
                        <Link href="/trees" className="text-gray-400 hover:text-white transition-colors hidden sm:block">
                            🌳 Trees
                        </Link>
                        <Link href="/leaves" className="text-gray-400 hover:text-white transition-colors hidden sm:block">
                            🍃 Leaves
                        </Link>
                        <Link href="/fruit" className="text-gray-400 hover:text-white transition-colors hidden sm:block">
                            🍎 Fruit
                        </Link>
                        <Link href="/agents" className="text-gray-400 hover:text-white transition-colors hidden sm:block">
                            🤖 Agents
                        </Link>
                        <Link href="/messages" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
                            💬 Messages
                        </Link>
                        <AuthButton />
                    </nav>
                </div>
            </div>
        </header>
    );
}
