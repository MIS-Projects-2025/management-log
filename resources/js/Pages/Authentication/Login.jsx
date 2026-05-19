import { useForm, usePage, Head, router } from "@inertiajs/react";

import InputError from "@/Components/InputError";
import InputLabel from "@/Components/InputLabel";
import TextInput from "@/Components/TextInput";
import { useEffect } from "react";

export default function Login() {
    const props = usePage().props;

    const { data, setData, post, processing, errors } = useForm({
        employeeID: "",
        password: "",
    });

    useEffect(() => {
        if (props.emp_data?.token) {
            localStorage.setItem("authify-token", props.emp_data.token);
            window.location.href = route("dashboard");
        }
    }, [props.emp_data]);

    const submit = (e) => {
        e.preventDefault();
        post(route("login"));
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Head title="Login" />
            {/* <pre>{JSON.stringify(props.emp_data, null, 2)}</pre> */}

            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
                <h2 className="mb-6 text-2xl font-semibold text-center">
                    LOGIN
                </h2>

                <InputError
                    message={errors.general}
                    className="py-2 mt-2 mb-4 font-medium text-center bg-red-100 rounded-m5"
                />

                <form onSubmit={submit} className="space-y-5">
                    <div>
                        <InputLabel htmlFor="employeeID" value="Employeee ID" />

                        <TextInput
                            id="employeeID"
                            type="text"
                            name="employeeID"
                            value={data.employeeID}
                            className="block w-full mt-1"
                            isFocused={true}
                            onChange={(e) =>
                                setData("employeeID", e.target.value)
                            }
                        />

                        <InputError
                            message={errors.employeeID}
                            className="mt-1"
                        />
                    </div>

                    <div className="mt-4">
                        <InputLabel htmlFor="password" value="Password" />

                        <TextInput
                            id="password"
                            type="password"
                            name="password"
                            value={data.password}
                            className="block w-full mt-1"
                            onChange={(e) =>
                                setData("password", e.target.value)
                            }
                        />

                        <InputError
                            message={errors.password}
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <button
                            type="submit"
                            className="w-full px-4 py-2 text-white transition bg-indigo-600 rounded hover:bg-indigo-700"
                            disabled={processing}
                        >
                            {processing ? "Logging in..." : "Login"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
