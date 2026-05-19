import { useState, useEffect, useMemo } from "react";
import { usePage, Link } from "@inertiajs/react";

export default function Dropdown({
    label,
    icon = null,
    links = [],
    notification = null,
}) {
    const { url } = usePage();

    const normalizePath = (href) => {
        try {
            const urlObj = new URL(href, window.location.origin);
            return urlObj.pathname;
        } catch {
            return href;
        }
    };

    const isActiveLink = (href) => {
        return url === new URL(href, window.location.origin).pathname;
    };

    const hasActiveLink = useMemo(() => {
        return links.some((link) => isActiveLink(link.href));
    }, [url, links]);

    const [open, setOpen] = useState(false);

    useEffect(() => {
        setOpen(hasActiveLink);
    }, [hasActiveLink]);

    const hoverColor =
        localStorage.getItem("theme") === "dark"
            ? "hover:bg-gray-800"
            : "hover:bg-gray-100";

    const activeColor =
        localStorage.getItem("theme") === "dark"
            ? "bg-gray-700"
            : "bg-gray-200";

    return (
        <div className="relative w-full">
            <button
                onClick={() => setOpen(!open)}
                className={`flex items-center justify-between w-full px-[10px] py-2 rounded ${hoverColor}`}
            >
                <div className="relative flex items-center space-x-1">
                    {icon && <span className="w-6 h-6 pt-[2px]">{icon}</span>}
                    <span className="pl-0 pr-1">{label}</span>

                    {/* Dropdown notification */}
                    {notification ? (
                        typeof notification === "number" ? (
                            <span className="ml-1 bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                                {notification > 99 ? "99+" : notification}
                            </span>
                        ) : (
                            <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                        )
                    ) : null}
                </div>

                <span className="pt-[3px]">
                    {open ? (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                            className="size-4"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m4.5 15.75 7.5-7.5 7.5 7.5"
                            />
                        </svg>
                    ) : (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                            className="size-4"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m19.5 8.25-7.5 7.5-7.5-7.5"
                            />
                        </svg>
                    )}
                </span>
            </button>

            {open && (
                <div className="mt-1 ml-6 space-y-1">
                    {links.map((link, index) => {
                        const active = isActiveLink(link.href);
                        const linkNotification = link.notification;

                        return (
                            <Link
                                key={`${normalizePath(link.href)}-${index}`}
                                href={link.href}
                                className={`flex items-center justify-between px-2 py-1 text-sm rounded transition-colors ${
                                    active ? `${activeColor}` : ""
                                } ${hoverColor}`}
                            >
                                <div className="flex items-center space-x-1">
                                    {link.icon ? (
                                        <span className="w-4 h-4">
                                            {link.icon}
                                        </span>
                                    ) : (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            strokeWidth="1.5"
                                            stroke="currentColor"
                                            className="size-4"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z"
                                            />
                                        </svg>
                                    )}
                                    <p className="pl-1">{link.label}</p>
                                </div>

                                {/* Per-link notification */}
                                {linkNotification ? (
                                    typeof linkNotification === "number" ? (
                                        <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-md">
                                            {linkNotification > 99
                                                ? "99+"
                                                : linkNotification}
                                        </span>
                                    ) : (
                                        <span className="w-2 h-2 mr-[7px] bg-red-600 rounded-full"></span>
                                    )
                                ) : null}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
