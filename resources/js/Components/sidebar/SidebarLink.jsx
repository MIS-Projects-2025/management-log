import React from "react";
import { Link, usePage } from "@inertiajs/react";

const SidebarLink = ({
    href,
    label,
    icon,
    notifications = 0,
}) => {
    const { url } = usePage();

    const isActive =
        url === new URL(href, window.location.origin).pathname;

    // Sidebar-friendly active / hover colors
    const baseClasses =
        "relative flex justify-between items-center px-4 py-2 pl-[10px] rounded-md transition-colors duration-150";

    const hoverClass =
        "hover:bg-white/10";

    const activeClass =
        isActive ? "bg-white/15" : "";

    return (
        <Link
            href={href}
            className={`${baseClasses} ${hoverClass} ${activeClass}`}
        >
            {/* Active indicator bar */}
            {isActive && (
                <span className="absolute left-0 top-1 bottom-1 w-[3px] bg-white rounded-r" />
            )}

            <div className="flex items-center gap-2">
                <span className="w-6 h-6 flex items-center justify-center">
                    {icon}
                </span>
                <p className="text-sm font-medium">
                    {label}
                </p>
            </div>

            {notifications > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-[2px] text-xs font-semibold text-white bg-red-600 rounded-md">
                    {notifications}
                </span>
            )}
        </Link>
    );
};

export default SidebarLink;
