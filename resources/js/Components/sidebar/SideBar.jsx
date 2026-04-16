import { Link, usePage } from "@inertiajs/react";
import { useState, useEffect } from "react";
import Navigation from "@/Components/sidebar/Navigation";
import ThemeToggler from "@/Components/sidebar/ThemeToggler";

export default function Sidebar() {
    const { display_name } = usePage().props;
    const [theme, setTheme] = useState("light");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const SIDEBAR_THEME = "#013328";

    useEffect(() => {
        const storedTheme = localStorage.getItem("theme") || "light";
        setTheme(storedTheme);
        document.documentElement.setAttribute("data-theme", storedTheme);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    };

    const formattedAppName = display_name
        ?.split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    return (
        <>
            {/* Mobile Hamburger */}
            <button
                className="fixed z-50 p-2 rounded top-4 right-4 md:hidden text-white"
                style={{ backgroundColor: SIDEBAR_THEME }}
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label="Toggle sidebar"
            >
                <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    {isSidebarOpen ? (
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    ) : (
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4 6h16M4 12h16M4 18h16"
                        />
                    )}
                </svg>
            </button>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed md:relative top-0 left-0 z-40
                    transition-transform duration-300 ease-in-out transform
                    ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
                    md:translate-x-0
                    flex flex-col min-h-screen w-[270px]
                    px-4 pb-6 pt-4
                    text-white
                `}
                style={{ backgroundColor: SIDEBAR_THEME }}
            >
                {/* Logo */}
                <div className="flex items-center justify-center mb-6">
                    <Link
                        href={route("dashboard")}
                        className="focus:outline-none focus:ring-2 focus:ring-white rounded"
                    >
                        <img
                            src="/Storage/telford_logo1.jpg"
                            alt={formattedAppName}
                            className="w-full h-auto max-w-[130px]"
                        />
                    </Link>
                </div>

                {/* Navigation */}
                <div
                    className="flex-1 overflow-y-auto"
                    style={{ scrollbarWidth: "none" }}
                >
                    <Navigation />
                </div>

                {/* Theme Toggler */}
                <div className="mt-auto pt-4">
                    <ThemeToggler toggleTheme={toggleTheme} theme={theme} />
                </div>
            </aside>
        </>
    );
}
