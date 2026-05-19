import DataTable from "@/Components/DataTable";
import Modal from "@/Components/Modal";
import toast, { Toaster } from "react-hot-toast";

export default function DemoPage({ tableData, tableFilters }) {
    toast.success("Successfully toasted!");

    return (
        <div className="px-10">
            <h1 className="text-2xl font-bold">Demo</h1>

            <h1 className="mt-10 text-2xl font-bold">Datatable</h1>

            <DataTable
                routeName={route("demo")} // set to your current route
                columns={[
                    { key: "emp_id", label: "ID" },
                    { key: "emp_name", label: "Employee Name" },
                    { key: "emp_role", label: "Role" },
                ]}
                data={tableData.data} // data
                meta={{
                    // for pagination
                    from: tableData.from,
                    to: tableData.to,
                    total: tableData.total,
                    links: tableData.links,
                    currentPage: tableData.current_page,
                    lastPage: tableData.last_page,
                }}
                filters={tableFilters} // filters
                rowKey="admin_id" // column to use as unique key for each row
                //
                // Enable Date Range Search
                dateRangeSearch={false}
                // Enable Date Range Search
                //
                // Enable CSV Export
                showExport={true}
                // Enable CSV Export
                //
                // Enable Multiple Selection
                selectable={true}
                onSelectionChange={(selectedRows) => {
                    console.log("Selected:", selectedRows);
                }}
                // Enable Multiple Selection
                //
                // DROPDOWN FILTER
                filterDropdown={{
                    key: "dropdownSearchValue",
                    fields: ["emp_role", "emp_id"], // Fields to search
                    options: [
                        // Dropdown Values
                        { value: "1714", label: "1714" },
                        { value: "superadmin", label: "superadmin" },
                        { value: "moderator", label: "Moderator" },
                    ],
                }}
                // DROPDOWN FILTER
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

            <h1 className="mt-10 text-2xl font-bold">Modal</h1>

            <Modal
                id="modalID"
                title={`Modal Title`}
                buttonText={`Open Modal`}
                buttonClass="btn"
                onClose={() => close()}
                className="w-[500px]"
            >
                <Modal
                    id="modalIDinner"
                    title={`Modal Title`}
                    buttonText={`Open Modal`}
                    buttonClass="btn"
                    onClose={() => close()}
                    className="w-[500px]"
                >
                    <p>some content</p>
                    <div className="flex justify-end gap-2">
                        <button className="btn">Button 1</button>
                        <button className="btn">Button 2</button>
                    </div>
                </Modal>

                <p>some content</p>
                <div className="flex justify-end gap-2">
                    <button className="btn">Button 1</button>
                    <button className="btn">Button 2</button>
                </div>
            </Modal>

            <h1 className="mt-10 text-2xl font-bold">Toast</h1>
            <a
                href="https://react-hot-toast.com/"
                target="_blank"
                className="text-blue-500"
            >
                React Hot Toast Documentation
            </a>
            <Toaster position="bottom-right" reverseOrder={false} />
        </div>
    );
}
