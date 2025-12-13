import React, { ReactNode } from 'react';

interface StatCardProps {
    title: string;
    value?: string | number;
    subtitle?: string;
    children?: ReactNode;
    className?: string; // For adding col-span-2 etc.
    icon?: ReactNode;
}

export function StatCard({ title, value, subtitle, children, className = "", icon }: StatCardProps) {
    return (
        <div className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col justify-between hover:bg-slate-800/80 transition-colors duration-300 ${className}`}>
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</h3>
                {icon && <div className="text-emerald-400">{icon}</div>}
            </div>

            {value && (
                <div className="text-4xl font-bold text-white mb-1">
                    {value}
                </div>
            )}

            {subtitle && (
                <div className="text-emerald-400 text-sm font-medium">
                    {subtitle}
                </div>
            )}

            {children && <div className="mt-4">{children}</div>}
        </div>
    );
}
