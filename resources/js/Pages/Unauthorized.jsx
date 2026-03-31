import React, { useEffect, useRef, useState } from "react";
import { Head, router } from "@inertiajs/react";

export default function Unauthorized() {
    const [countdown, setCountdown] = useState(5);
    const timerRef = useRef(null);

    const triggerLogout = () => {
        clearInterval(timerRef.current);
        window.location.href = route("logout");
    };

    useEffect(() => {
        timerRef.current = setInterval(() => {
            setCountdown((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timerRef.current);
    }, []);

    useEffect(() => {
        if (countdown === 0) {
            triggerLogout();
        }
    }, [countdown]);

    return (
        <>
            <Head title="Unauthorized" />

            <div className="flex items-center justify-center min-h-screen px-6 bg-gray-100 dark:bg-gray-900">
                <div className="text-center max-w-lg">
                    <h1 className="text-[60pt] font-bold text-gray-800 dark:text-gray-100 mb-4">
                        Unauthorized
                    </h1>

                    <p className="text-lg text-gray-500 dark:text-gray-400 mb-6">
                        This account does not have access to this system.
                        <br />
                        Only <b>Security</b> and <b>Operations</b> departments are allowed.
                    </p>

                    <p className="text-md text-gray-600 dark:text-gray-300 mb-6">
                        Logging you out in{" "}
                        <span className="font-bold text-red-500">{countdown}</span>{" "}
                        seconds…
                    </p>

                    <button
                        onClick={triggerLogout}
                        className="px-6 py-3 bg-red-600 text-white rounded-lg
                                   hover:bg-red-700 transition font-semibold"
                    >
                        Go Back / Relogin Now
                    </button>
                </div>
            </div>
        </>
    );
}