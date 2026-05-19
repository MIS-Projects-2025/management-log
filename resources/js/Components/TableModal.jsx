import { useEffect } from "react";

export default function TableModal({
    id,
    title,
    children,
    buttonText,
    buttonClass = "btn",
    show = false,
    onClose = () => {},
}) {
    useEffect(() => {
        if (show) {
            document.getElementById(id)?.showModal?.();
        } else {
            document.getElementById(id)?.close?.();
        }
    }, [show, id]);

    return (
        <>
            {/* Optional trigger button */}
            {buttonText && (
                <button
                    className={buttonClass}
                    onClick={() => document.getElementById(id)?.showModal()}
                >
                    {buttonText}
                </button>
            )}

            <dialog id={id} className="modal">
                <div className="modal-box">
                    <h3 className="text-lg font-bold">{title}</h3>
                    <div className="py-4">{children}</div>
                    <div className="modal-action">
                        <button className="btn" onClick={() => onClose()}>
                            Close
                        </button>
                    </div>
                </div>
            </dialog>
        </>
    );
}
