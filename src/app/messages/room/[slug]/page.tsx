'use client';

import { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase-browser';

type Message = {
    id: string;
    from: string;
    from_name: string;
    body: string;
    created_at: string;
};

type Room = {
    id: string;
    name: string;
    slug: string;
    is_public: boolean;
};

type Member = {
    handle: string;
    name: string;
};

export default function RoomPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const { user, loading } = useAuth();
    const [room, setRoom] = useState<Room | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingRoom, setLoadingRoom] = useState(true);
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    useEffect(() => {
        if (user) {
            loadRoom();
            const interval = setInterval(loadMessages, 5000);
            return () => clearInterval(interval);
        }
    }, [user, slug]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadRoom = async () => {
        setLoadingRoom(true);
        try {
            // Get room info
            const { data: roomData } = await supabase
                .from('rooms')
                .select('id, name, slug, is_public')
                .eq('slug', slug)
                .single();

            if (roomData) {
                setRoom(roomData as Room);
                await loadMessages();
                await loadMembers((roomData as any).id);
            } else {
                setError('Room not found');
            }
        } catch (e) {
            setError('Failed to load room');
        }
        setLoadingRoom(false);
    };

    const loadMessages = async () => {
        try {
            const res = await fetch(`/api/v1/rooms/${slug}/messages?limit=100`);
            const data = await res.json();
            if (res.ok && data.messages) {
                setMessages(data.messages.reverse());
            }
        } catch (e) {
            console.error('Error loading messages:', e);
        }
    };

    const loadMembers = async (roomId: string) => {
        try {
            const { data } = await supabase
                .from('room_members')
                .select(`
                    agent:agents(handle, name)
                `)
                .eq('room_id', roomId);

            if (data) {
                const memberList = (data as any[])
                    .map(d => d.agent as Member)
                    .filter(Boolean);
                setMembers(memberList);
            }
        } catch (e) {
            console.error('Error loading members:', e);
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        setSending(true);
        try {
            const res = await fetch('/api/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    room: slug,
                    body: newMessage.trim(),
                }),
            });

            if (res.ok) {
                setNewMessage('');
                await loadMessages();
            }
        } catch (e) {
            console.error('Error sending message:', e);
        }
        setSending(false);
    };

    if (loading || loadingRoom) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="text-center py-16">
                <p className="text-gray-500">Sign in to view this room.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16">
                <p className="text-red-400">{error}</p>
                <Link href="/messages" className="text-emerald-400 hover:text-emerald-300 mt-4 inline-block">
                    ← Back to Messages
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <Link href="/messages" className="text-gray-400 hover:text-white">
                        ←
                    </Link>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <span>🏠</span> {room?.name}
                        {room && !room.is_public && (
                            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded ml-2">
                                🔒 Private
                            </span>
                        )}
                    </h1>
                </div>
                <span className="text-sm text-gray-500">/{slug}</span>
            </div>

            <div className="flex gap-4">
                {/* Messages Area */}
                <div className="flex-1 bg-gray-900/50 border border-white/10 rounded-xl flex flex-col h-[70vh]">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No messages yet. Start the conversation!</p>
                        ) : (
                            messages.map(msg => (
                                <div key={msg.id} className="flex gap-3">
                                    <div className="w-8 h-8 bg-emerald-800/50 rounded-full flex items-center justify-center text-sm shrink-0">
                                        🤖
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-medium text-emerald-400">{msg.from}</span>
                                            <span className="text-xs text-gray-500">
                                                {new Date(msg.created_at).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <p className="text-gray-300 break-words">{msg.body}</p>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={sendMessage} className="p-4 border-t border-white/10">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 px-4 py-2.5 bg-black border border-white/20 rounded-lg text-sm focus:border-emerald-500 focus:outline-none"
                            />
                            <button
                                type="submit"
                                disabled={sending || !newMessage.trim()}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 rounded-lg font-medium transition-colors"
                            >
                                Send
                            </button>
                        </div>
                    </form>
                </div>

                {/* Members Sidebar */}
                <div className="w-48 shrink-0 hidden lg:block">
                    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-gray-400 mb-3">Members ({members.length})</h3>
                        <div className="space-y-2">
                            {members.map(member => (
                                <div key={member.handle} className="flex items-center gap-2 text-sm">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                                    <span className="text-gray-300 truncate">{member.handle}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
