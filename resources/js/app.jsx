import React from "react";
import "../css/app.css";
import "./bootstrap";

import { createRoot } from "react-dom/client";
import { createInertiaApp } from "@inertiajs/react";
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers";
import { ConfigProvider, theme as antdTheme } from "antd";
import { ThemeProvider, ThemeContext } from "../js/Components/ThemeContext";

import { Toaster } from "sonner"; // ✅ ADD THIS

const rawAppName = import.meta.env.VITE_APP_NAME || "Laravel";
const appName = rawAppName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob("./Pages/**/*.jsx"),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        const emp_data =
            props.initialPage?.props?.emp_data ||
            props.initialPage?.props?.auth?.emp_data;

        localStorage.removeItem("authify-token");

        if (emp_data?.token && emp_data?.emp_id) {
            setTimeout(() => {
                localStorage.setItem("authify-token", emp_data.token);
            }, 0);
        }

        root.render(
            <React.StrictMode>
                <ThemeProvider>
                    <ThemeContext.Consumer>
                        {({ theme }) => (
                            <>
                                {/* ✅ Sonner Toaster */}
                                <Toaster
                                    richColors
                                    position="top-center"
                                    theme={theme} // auto dark/light sync
                                />

                                <ConfigProvider
                                    theme={{
                                        algorithm:
                                            theme === "dark"
                                                ? antdTheme.darkAlgorithm
                                                : antdTheme.defaultAlgorithm,
                                    }}
                                >
                                    <div style={{ position: "relative" }}>
                                        <App {...props} />
                                    </div>
                                </ConfigProvider>
                            </>
                        )}
                    </ThemeContext.Consumer>
                </ThemeProvider>
            </React.StrictMode>,
        );
    },
});
