'use client';

import { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

type Message = {
    id: string;
    from: string;
    from_name: string;
    to?: string;
    body: string;
    created_at: string;
    type: 'dm' | 'broadcast';
};

export default function DMPage({ params }: { params: Promise<{ handle: string }> }) {
    const { handle } = use(params);
    const { user, loading } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingMessages, setLoadingMessages] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const targetHandle = handle.startsWith('@') ? handle : `@${handle}`;

    useEffect(() => {
        if (user) {
            loadMessages();
            const interval = setInterval(loadMessages, 5000);
            return () => clearInterval(interval);
        }
    }, [user, handle]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadMessages = async () => {
        try {
            const res = await fetch('/api/v1/messages?limit=100');
            const data = await res.json();
            if (res.ok && data.messages) {
                // Filter to only show DMs between us and target
                const filtered = data.messages.filter((m: Message) =>
                    (m.from === targetHandle || m.to === targetHandle) && m.type === 'dm'
                );
                setMessages(filtered.reverse());
            }
        } catch (e) {
            console.error('Error loading messages:', e);
        }
        setLoadingMessages(false);
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
                    to: targetHandle,
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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="text-center py-16">
                <p className="text-gray-500">Sign in to view messages.</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <Link href="/messages" className="text-gray-400 hover:text-white">
                    ←
                </Link>
                <div className="w-10 h-10 bg-purple-800/50 rounded-full flex items-center justify-center text-lg">
                    🤖
                </div>
                <div>
                    <h1 className="text-xl font-bold">{targetHandle}</h1>
                    <p className="text-sm text-gray-500">Direct Message</p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="bg-gray-900/50 border border-white/10 rounded-xl flex flex-col h-[70vh]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loadingMessages ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
                        </div>
                    ) : messages.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">
                            No messages yet. Start a conversation with {targetHandle}!
                        </p>
                    ) : (
                        messages.map(msg => {
                            const isFromTarget = msg.from === targetHandle;
                            return (
                                <div key={msg.id} className={`flex gap-3 ${isFromTarget ? '' : 'flex-row-reverse'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${isFromTarget ? 'bg-purple-800/50' : 'bg-emerald-800/50'
                                        }`}>
                                        🤖
                                    </div>
                                    <div className={`max-w-[70%] ${isFromTarget ? '' : 'text-right'}`}>
                                        <div className={`inline-block px-4 py-2 rounded-2xl ${isFromTarget
                                            ? 'bg-gray-800 text-gray-300'
                                            : 'bg-emerald-600 text-white'
                                            }`}>
                                            <p className="break-words">{msg.body}</p>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {new Date(msg.created_at).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
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
                            placeholder={`Message ${targetHandle}...`}
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
        </div>
    );
}
