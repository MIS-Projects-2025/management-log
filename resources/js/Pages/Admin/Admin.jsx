import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, usePage, router } from "@inertiajs/react";
import DataTable from "@/Components/DataTable";
import Modal from "@/Components/Modal";

import { useState } from "react";

export default function Admin({ tableData, tableFilters, emp_data }) {
    const [role, setRole] = useState(null);

    function removeAdmin(id) {
        router.post(
            route("removeAdmin"),
            { id },
            {
                preserveScroll: true,
                onSuccess: () => {
                    console.log("Admin removed");
                },
            }
        );
    }

    function changeRole(id) {
        role &&
            router.patch(
                route("changeAdminRole"),
                { id, role },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        console.log("Admin role changed");
                    },
                }
            );
    }

    const tableModalClose = (close) => {
        setRole(null);
        close();
    };

    return (
        <AuthenticatedLayout>
            <Head title="Manage Administrators" />

            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold">Administrators</h1>

                {["superadmin", "admin"].includes(
                    emp_data?.emp_system_role
                ) && (
                    <button
                        className="text-blue-600 border-blue-600 btn"
                        onClick={() =>
                            router.get(
                                route("index_addAdmin"),
                                {},
                                { preserveScroll: true }
                            )
                        }
                    >
                        Add New Admin
                    </button>
                )}
            </div>

            <DataTable
                columns={[
                    { key: "emp_id", label: "ID" },
                    { key: "emp_name", label: "Employee Name" },
                    { key: "emp_role", label: "Role" },
                ]}
                data={tableData.data}
                meta={{
                    from: tableData.from,
                    to: tableData.to,
                    total: tableData.total,
                    links: tableData.links,
                    currentPage: tableData.current_page,
                    lastPage: tableData.last_page,
                }}
                routeName={route("admin")}
                filters={tableFilters}
                rowKey="EMPLOYID"
                // selectable={true}
                // onSelectionChange={setSelectedRows}
                // dateRangeSearch={true}
                showExport={false}
            >
                {(row, close) => (
                    <Modal
                        id="RowModal"
                        title={`Admin Details`}
                        show={true}
                        onClose={() => tableModalClose(close)}
                        className="w-[300px]"
                    >
                        <p>
                            <strong>ID:</strong> {row.emp_id}
                        </p>
                        <strong>Name:</strong> {row.emp_name}
                        <p>
                            <strong>Role:</strong> {row.emp_role}
                        </p>
                        {["superadmin", "admin"].includes(
                            emp_data?.emp_system_role
                        ) && (
                            <div>
                                <select
                                    defaultValue={row.emp_role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="mt-5 select"
                                >
                                    {/* <option value={null}></option> */}
                                    <option value="superadmin">
                                        Superadmin
                                    </option>
                                    <option value="admin">Admin</option>
                                    <option value="moderator">Moderator</option>
                                </select>

                                <div className="flex justify-end gap-1 mt-5">
                                    <button
                                        className="text-blue-600 btn"
                                        onClick={() => changeRole(row.emp_id)}
                                    >
                                        Update Role
                                    </button>
                                    <button
                                        className="text-red-600 btn"
                                        onClick={() => removeAdmin(row.emp_id)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        )}
                    </Modal>
                )}
            </DataTable>
        </AuthenticatedLayout>
    );
}
