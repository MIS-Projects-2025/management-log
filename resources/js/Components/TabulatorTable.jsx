import React, { useEffect, useRef } from "react";
import { TabulatorFull as Tabulator } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";

export default function TabulatorTable({
    url, // Laravel endpoint (paginated)
    columns, // Column definition for Tabulator
    perPage = 10, // Items per page
    additionalParams = {}, // Extra filters or query params
}) {
    const tableRef = useRef(null);
    const tabulatorRef = useRef(null); // for possible external control

    useEffect(() => {
        if (tabulatorRef.current) {
            tabulatorRef.current.destroy();
        }

        tabulatorRef.current = new Tabulator(tableRef.current, {
            layout: "fitColumns",
            pagination: "remote",
            paginationSize: perPage,
            ajaxURL: url,
            ajaxParams: additionalParams,
            ajaxConfig: "GET",
            ajaxResponse: (url, params, response) => {
                // Laravel-style pagination response
                return response.data;
            },
            paginationDataReceived: {
                last_page: "meta.last_page",
                data: "data",
                current_page: "meta.current_page",
                per_page: "meta.per_page",
                total: "meta.total",
            },
            paginationDataSent: {
                page: "page",
                size: "perPage",
            },
            columns: columns,
        });

        // Cleanup on unmount
        return () => {
            tabulatorRef.current?.destroy();
        };
    }, [url, JSON.stringify(additionalParams)]);

    return <div ref={tableRef}></div>;
}
