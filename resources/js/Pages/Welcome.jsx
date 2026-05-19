import DataTable from "@/Components/DataTable";
import Modal from "@/Components/Modal";

export default function dashboard({ tableData, tableFilters }) {
    return (
        <div>
            <h1 className="text-2xl font-bold">Demo</h1>

            <h1 className="mt-10 text-2xl font-bold">Datatable</h1>

            {/* <h1 className="mt-5 text-xl font-bold">Basic Table with Search</h1>
            <DataTable
                columns={[
                    { key: "emp_id", label: "ID" },
                    { key: "emp_name", label: "Employee Name" },
                    { key: "emp_role", label: "Role" },
                ]}
                data={tableData.data} // data
                meta={{
                    from: tableData.from,
                    to: tableData.to,
                    total: tableData.total,
                    links: tableData.links,
                    currentPage: tableData.current_page,
                    lastPage: tableData.last_page,
                }}
                routeName={"/welcome"} // where you currently are
                filters={tableFilters} // filters
                rowKey="admin_id" // column to use as unique key for each row
            >
                {(row, close) => (
                    <Modal
                        id="RowModal"
                        title={`Modal Title`}
                        show={true}
                        onClose={() => close()}
                        className="w-[500px]"
                    >
                        <pre>{JSON.stringify(row, null, 2)}</pre>

                        <div className="flex justify-end gap-2">
                            <button className="btn">Button 1</button>
                            <button className="btn">Button 2</button>
                        </div>
                    </Modal>
                )}
            </DataTable>

            <h1 className="mt-5 text-xl font-bold">
                Table with Date Range Filter and CSV Export
            </h1>
            <DataTable
                columns={[
                    { key: "emp_id", label: "ID" },
                    { key: "emp_name", label: "Employee Name" },
                    { key: "emp_role", label: "Role" },
                ]}
                data={tableData.data} // data
                meta={{
                    from: tableData.from,
                    to: tableData.to,
                    total: tableData.total,
                    links: tableData.links,
                    currentPage: tableData.current_page,
                    lastPage: tableData.last_page,
                }}
                routeName={"/welcome"} // where you currently are
                filters={tableFilters} // filters
                rowKey="admin_id" // column to use as unique key for each row
                dateRangeSearch={true} // enable date range search
                showExport={true} // enable export
            >
                {(row, close) => (
                    <Modal
                        id="RowModal"
                        title={`Modal Title`}
                        show={true}
                        onClose={() => close()}
                        className="w-[500px]"
                    >
                        <pre>{JSON.stringify(row, null, 2)}</pre>

                        <div className="flex justify-end gap-2">
                            <button className="btn">Button 1</button>
                            <button className="btn">Button 2</button>
                        </div>
                    </Modal>
                )}
            </DataTable>

            <h1 className="mt-5 text-xl font-bold">
                Table with Checkbox Selection
            </h1>
            <DataTable
                columns={[
                    { key: "emp_id", label: "ID" },
                    { key: "emp_name", label: "Employee Name" },
                    { key: "emp_role", label: "Role" },
                ]}
                data={tableData.data} // data
                meta={{
                    from: tableData.from,
                    to: tableData.to,
                    total: tableData.total,
                    links: tableData.links,
                    currentPage: tableData.current_page,
                    lastPage: tableData.last_page,
                }}
                routeName={"/welcome"} // where you currently are
                filters={tableFilters} // filters
                rowKey="admin_id" // column to use as unique key for each row
                selectable={true} // enable checkbox selection
                onSelectionChange={(selectedRows) => {
                    // handle selection
                    console.log("Selected:", selectedRows);
                }}
            >
                {(row, close) => (
                    <Modal
                        id="RowModal"
                        title={`Modal Title`}
                        show={true}
                        onClose={() => close()}
                        className="w-[500px]"
                    >
                        <pre>{JSON.stringify(row, null, 2)}</pre>

                        <div className="flex justify-end gap-2">
                            <button className="btn">Button 1</button>
                            <button className="btn">Button 2</button>
                        </div>
                    </Modal>
                )}
            </DataTable> */}

            <h1 className="mt-5 text-xl font-bold">yrdy</h1>
            <DataTable
                columns={[
                    { key: "emp_id", label: "ID" },
                    { key: "emp_name", label: "Employee Name" },
                    { key: "emp_role", label: "Role" },
                ]}
                data={tableData.data} // data
                meta={{
                    from: tableData.from,
                    to: tableData.to,
                    total: tableData.total,
                    links: tableData.links,
                    currentPage: tableData.current_page,
                    lastPage: tableData.last_page,
                }}
                routeName={"/welcome"} // where you currently are
                filters={tableFilters} // filters
                rowKey="admin_id" // column to use as unique key for each row
                filterDropdown={{
                    key: "dropdownSearchValue",
                    fields: ["emp_role", "emp_id"],
                    options: [
                        { value: "1714", label: "1714" },
                        { value: "admin", label: "Admin" },
                        { value: "moderator", label: "moderator" },
                    ],
                }}
            >
                {(row, close) => (
                    <Modal
                        id="RowModal"
                        title={`Modal Title`}
                        show={true}
                        onClose={close}
                        className="w-[500px]"
                    >
                        <pre>{JSON.stringify(row, null, 2)}</pre>

                        <div className="flex justify-end gap-2">
                            <button className="btn">Button 1</button>
                            <button className="btn">Button 2</button>
                        </div>
                    </Modal>
                )}
            </DataTable>
        </div>
    );
}
