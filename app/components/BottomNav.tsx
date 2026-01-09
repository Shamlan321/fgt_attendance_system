'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/app/lib/utils';

export default function BottomNav() {
    const pathname = usePathname();

    const links = [
        { href: '/', label: 'Dashboard', icon: '📊' },
        { href: '/employees', label: 'Employees', icon: '👥' },
        { href: '/reports', label: 'Reports', icon: '📄' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
            <div className="max-w-md mx-auto px-4">
                <div className="flex justify-around items-center h-16">
                    {links.map((link) => {
                        const isActive = pathname === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    'flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors',
                                    isActive
                                        ? 'text-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                )}
                            >
                                <span className="text-2xl mb-1">{link.icon}</span>
                                <span className="text-xs font-medium">{link.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
