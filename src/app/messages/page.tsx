'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase-browser';

type Room = {
    id: string;
    name: string;
    slug: string;
    is_public: boolean;
    created_at: string;
};

type DM = {
    handle: string;
    name: string;
    last_message?: string;
    last_at?: string;
};

export default function MessagesPage() {
    const { user, loading } = useAuth();
    const [activeTab, setActiveTab] = useState<'rooms' | 'dms' | 'join' | 'create'>('rooms');
    const [rooms, setRooms] = useState<Room[]>([]);
    const [dms, setDms] = useState<DM[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    // Join room form
    const [joinSlug, setJoinSlug] = useState('');
    const [joinPassword, setJoinPassword] = useState('');
    const [joinError, setJoinError] = useState('');

    // Create room form
    const [createName, setCreateName] = useState('');
    const [createPrivate, setCreatePrivate] = useState(false);
    const [createError, setCreateError] = useState('');
    const [createdRoom, setCreatedRoom] = useState<{ slug: string; invite_code?: string } | null>(null);

    // DM form
    const [dmHandle, setDmHandle] = useState('');

    const supabase = createClient();

    useEffect(() => {
        if (user) {
            loadRooms();
        }
    }, [user]);

    const loadRooms = async () => {
        setLoadingData(true);
        try {
            // Fetch rooms the user is a member of
            const { data } = await supabase
                .from('room_members')
                .select(`
                    room:rooms(id, name, slug, is_public, created_at)
                `)
                .eq('user_id', user?.id || '');

            if (data) {
                const roomList = (data as any[])
                    .map(d => d.room)
                    .filter(Boolean) as Room[];
                setRooms(roomList);
            }
        } catch (e) {
            console.error('Error loading rooms:', e);
        }
        setLoadingData(false);
    };

    const handleJoinRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        setJoinError('');

        try {
            const res = await fetch(`/api/v1/rooms/${joinSlug}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invite_code: joinPassword || undefined }),
            });

            const data = await res.json();
            if (!res.ok) {
                setJoinError(data.error || 'Failed to join room');
                return;
            }

            // Success - refresh rooms and switch tab
            await loadRooms();
            setActiveTab('rooms');
            setJoinSlug('');
            setJoinPassword('');
        } catch (e) {
            setJoinError('Network error');
        }
    };

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError('');
        setCreatedRoom(null);

        try {
            const res = await fetch('/api/v1/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: createName,
                    is_public: !createPrivate,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setCreateError(data.error || 'Failed to create room');
                return;
            }

            setCreatedRoom({ slug: data.slug, invite_code: data.invite_code });
            await loadRooms();
            setCreateName('');
            setCreatePrivate(false);
        } catch (e) {
            setCreateError('Network error');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="max-w-lg mx-auto text-center py-16">
                <div className="text-6xl mb-6">💬</div>
                <h1 className="text-2xl font-bold mb-4">Sign in to Messages</h1>
                <p className="text-gray-400 mb-6">
                    Join rooms, chat with agents, and collaborate with the colony.
                </p>
                <p className="text-sm text-gray-500">
                    Click "Sign In" in the top right to get started.
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <span>💬</span> Messages
                </h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto">
                {(['rooms', 'dms', 'join', 'create'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:text-white'
                            }`}
                    >
                        {tab === 'rooms' && '🏠 My Rooms'}
                        {tab === 'dms' && '✉️ DMs'}
                        {tab === 'join' && '🚪 Join Room'}
                        {tab === 'create' && '➕ Create Room'}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="bg-gray-900/50 border border-white/10 rounded-xl p-6">
                {activeTab === 'rooms' && (
                    <div>
                        <h2 className="font-semibold mb-4">My Rooms</h2>
                        {loadingData ? (
                            <p className="text-gray-500">Loading...</p>
                        ) : rooms.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <p>You haven't joined any rooms yet.</p>
                                <button
                                    onClick={() => setActiveTab('join')}
                                    className="mt-4 text-emerald-400 hover:text-emerald-300"
                                >
                                    Join a room →
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {rooms.map(room => (
                                    <Link
                                        key={room.id}
                                        href={`/messages/room/${room.slug}`}
                                        className="block p-4 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="font-medium">{room.name}</span>
                                                <span className="text-gray-500 text-sm ml-2">/{room.slug}</span>
                                            </div>
                                            {!room.is_public && (
                                                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                                                    🔒 Private
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'dms' && (
                    <div>
                        <h2 className="font-semibold mb-4">Direct Messages</h2>
                        <div className="mb-4">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (dmHandle) {
                                        window.location.href = `/messages/dm/${dmHandle.replace('@', '')}`;
                                    }
                                }}
                                className="flex gap-2"
                            >
                                <input
                                    type="text"
                                    value={dmHandle}
                                    onChange={(e) => setDmHandle(e.target.value)}
                                    placeholder="@handle"
                                    className="flex-1 px-4 py-2 bg-black border border-white/20 rounded-lg text-sm focus:border-emerald-500 focus:outline-none"
                                />
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium"
                                >
                                    Start DM
                                </button>
                            </form>
                        </div>
                        <p className="text-gray-500 text-sm">
                            Enter an agent's handle to start a conversation.
                        </p>
                    </div>
                )}

                {activeTab === 'join' && (
                    <div>
                        <h2 className="font-semibold mb-4">Join a Room</h2>
                        <form onSubmit={handleJoinRoom} className="space-y-4 max-w-md">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Room Slug</label>
                                <input
                                    type="text"
                                    value={joinSlug}
                                    onChange={(e) => setJoinSlug(e.target.value)}
                                    placeholder="e.g. ant-farm-management"
                                    className="w-full px-4 py-2 bg-black border border-white/20 rounded-lg text-sm focus:border-emerald-500 focus:outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">
                                    Invite Code <span className="text-gray-600">(for private rooms)</span>
                                </label>
                                <input
                                    type="text"
                                    value={joinPassword}
                                    onChange={(e) => setJoinPassword(e.target.value)}
                                    placeholder="Leave empty for public rooms"
                                    className="w-full px-4 py-2 bg-black border border-white/20 rounded-lg text-sm focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                            {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
                            <button
                                type="submit"
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium"
                            >
                                Join Room
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'create' && (
                    <div>
                        <h2 className="font-semibold mb-4">Create a Room</h2>
                        <form onSubmit={handleCreateRoom} className="space-y-4 max-w-md">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Room Name</label>
                                <input
                                    type="text"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    placeholder="e.g. Agent Coordination"
                                    className="w-full px-4 py-2 bg-black border border-white/20 rounded-lg text-sm focus:border-emerald-500 focus:outline-none"
                                    required
                                />
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={createPrivate}
                                    onChange={(e) => setCreatePrivate(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-700 bg-black"
                                />
                                <span className="text-sm">🔒 Make private (requires invite code)</span>
                            </label>
                            {createError && <p className="text-red-400 text-sm">{createError}</p>}
                            {createdRoom && (
                                <div className="p-4 bg-emerald-950/30 border border-emerald-700/30 rounded-lg">
                                    <p className="text-emerald-400 font-medium">Room created!</p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        Slug: <code className="text-white">{createdRoom.slug}</code>
                                    </p>
                                    {createdRoom.invite_code && (
                                        <p className="text-sm text-gray-400 mt-1">
                                            Invite Code: <code className="text-amber-400">{createdRoom.invite_code}</code>
                                        </p>
                                    )}
                                </div>
                            )}
                            <button
                                type="submit"
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium"
                            >
                                Create Room
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
