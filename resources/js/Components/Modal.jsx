// Modal.jsx
import { useEffect, useRef } from "react";

export default function Modal({
    id,
    title = "Modal Title",
    buttonText = "",
    children,
    buttonClass = "",
    className = "",
    show = false,
    onClose = () => {},
}) {
    const modalRef = useRef(null);

    useEffect(() => {
        if (show) {
            modalRef.current?.showModal();
        } else {
            modalRef.current?.close();
        }
    }, [show]);

    return (
        <>
            {buttonText && (
                <button
                    className={buttonClass}
                    onClick={() => modalRef.current?.showModal()}
                >
                    {buttonText}
                </button>
            )}

            <dialog id={id} className="modal" ref={modalRef} onClose={onClose}>
                <div className={`modal-box ${className}`}>
                    <div>
                        <button
                            type="button"
                            className="absolute btn btn-sm btn-circle btn-ghost right-2 top-2"
                            onClick={() => {
                                modalRef.current?.close();
                                onClose();
                            }}
                        >
                            ✕
                        </button>
                        <h3 className="text-lg font-bold">{title}</h3>
                        <div className="pt-4">{children}</div>
                    </div>
                </div>
            </dialog>
        </>
    );
}
