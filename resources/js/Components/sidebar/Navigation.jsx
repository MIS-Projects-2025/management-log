import SidebarLink from "@/Components/sidebar/SidebarLink";
import {
    DashboardOutlined,
    ScanOutlined,
    CrownOutlined,
} from "@ant-design/icons";
import { usePage } from "@inertiajs/react";

export default function NavLinks() {
    const { emp_data } = usePage().props;
    const empDept = emp_data?.emp_dept;

    return (
        <nav
            className="flex flex-col flex-grow space-y-1 overflow-y-auto"
            style={{ scrollbarWidth: "none" }}
        >
            {/* Dashboard */}
            <SidebarLink
                href={route("dashboard")}
                label="Dashboard"
                icon={<DashboardOutlined className="text-lg" />}
            />

            {/* Scan Logs */}
            {['Human Resource', 'Security', 'Operations'].includes(empDept) && (
                <>
                    {/* Scan Logs */}
                    <SidebarLink
                        href={route("scan-logs.index")}
                        label="Scan Logs"
                        icon={<ScanOutlined className="text-lg" />}
                    />
                    {/* Register Fingerprint */}
                    <SidebarLink
                        href={route("register-fingerprint.index")}
                        label="Register Fingerprint"
                        icon={<ScanOutlined className="text-lg" />}
                    />
                </>
            )}

            {/* Management Logs */}
            <SidebarLink
                href={route("management-logs.index")}
                label="Management Logs"
                icon={<CrownOutlined className="text-lg" />}
            />
        </nav>
    );
}