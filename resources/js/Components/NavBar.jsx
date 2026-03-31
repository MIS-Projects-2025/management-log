import { Link, usePage, router } from "@inertiajs/react";
import {
    UserOutlined,
    LogoutOutlined,
    DownOutlined,
} from "@ant-design/icons";

export default function NavBar() {
    const { emp_data } = usePage().props;

    const NAV_THEME = "#013328";

    const logout = () => {
        localStorage.clear();
        sessionStorage.clear();

        window.location.href = route("logout"); // Laravel handles SSO redirect
    };

    return (
        <nav
            className="border-b border-black/10"
            style={{ backgroundColor: NAV_THEME }}
        >
            <div className="px-4 mx-auto sm:px-6 lg:px-8">
                <div className="flex justify-end h-[50px] items-center text-white">
                    <div className="hidden md:flex items-center">
                        <div className="relative group">
                            {/* Trigger */}
                            <div className="flex items-center gap-2 px-3 py-1 rounded-md cursor-pointer select-none hover:bg-white/10 transition">
                                <UserOutlined className="text-lg" />
                                <span className="text-sm">
                                    Hello, {emp_data?.emp_firstname}
                                </span>
                                <DownOutlined className="text-xs opacity-70" />
                            </div>

                            {/* Dropdown */}
                            <div className="absolute right-0 mt-2 w-52 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                                <Link
                                    href={route("profile.index")}
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    <UserOutlined />
                                    Profile
                                </Link>

                                <button
                                    onClick={logout}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-gray-700 hover:bg-red-50 hover:text-red-600"
                                >
                                    <LogoutOutlined />
                                    Log out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
