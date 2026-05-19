import { createContext, useState, useEffect } from "react";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState("light");

    useEffect(() => {
        const stored = localStorage.getItem("theme") || "light";
        applyTheme(stored);
        setTheme(stored);
    }, []);

    const applyTheme = (t) => {
        // shadcn — needs class on <html>
        document.documentElement.classList.toggle("dark", t === "dark");
        // daisyUI — needs data-theme attribute
        document.documentElement.setAttribute("data-theme", t);
    };

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        applyTheme(newTheme);
        localStorage.setItem("theme", newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
