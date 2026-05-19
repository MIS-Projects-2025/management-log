import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, usePage, router } from "@inertiajs/react";
import DataTable from "@/Components/DataTable";
import Modal from "@/Components/Modal";

import { useState } from "react";

export default function NewAdmin({ tableData, tableFilters, emp_data }) {
    const [role, setRole] = useState(null);

    function addAdmin(id, name) {
        role &&
            router.post(
                route("addAdmin"),
                { id, role, name },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        router.visit(route("admin"));
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
                <h1 className="text-2xl font-bold">Add New Administrator</h1>
            </div>

            <DataTable
                columns={[
                    { key: "EMPLOYID", label: "ID" },
                    { key: "EMPNAME", label: "Employee Name" },
                    { key: "JOB_TITLE", label: "Job Title" },
                    { key: "DEPARTMENT", label: "Department" },
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
                routeName={route("index_addAdmin")}
                filters={tableFilters}
                rowKey="EMPLOYID"
                showExport={false}
            >
                {(row, close) => (
                    <Modal
                        id="MasterlistRowModal"
                        title={`Employee Details`}
                        show={true}
                        onClose={close}
                        className="w-[350px] max-w-none"
                    >
                        <p>
                            <strong>ID:</strong> {row.EMPLOYID}
                        </p>
                        <p>
                            <strong>Name:</strong> {row.EMPNAME}
                        </p>
                        <p>
                            <strong>Job Title:</strong> {row.JOB_TITLE}
                        </p>
                        <p>
                            <strong>Department:</strong> {row.DEPARTMENT}
                        </p>

                        <select
                            onChange={(e) => setRole(e.target.value)}
                            className="mt-5 select"
                        >
                            {/* <option value={null}></option> */}
                            <option value={null}></option>
                            <option value="superadmin">Superadmin</option>
                            <option value="admin">Admin</option>
                            <option value="moderator">Moderator</option>
                        </select>

                        <div className="flex justify-end mt-4">
                            {role && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() =>
                                        addAdmin(row.EMPLOYID, row.EMPNAME)
                                    }
                                >
                                    Add
                                </button>
                            )}
                        </div>
                    </Modal>
                )}
            </DataTable>
        </AuthenticatedLayout>
    );
}
