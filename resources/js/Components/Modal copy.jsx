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

    // Open or close modal based on `show`
    useEffect(() => {
        const modal = modalRef.current;
        if (!modal) return;

        // Prevent browser warning by checking state first
        if (show && !modal.open) {
            modal.showModal();
        } else if (!show && modal.open) {
            modal.close();
        }
    }, [show]);

    // Close handler with open check
    const handleClose = () => {
        const modal = modalRef.current;
        if (modal?.open) {
            modal.close();
            onClose(); // inform parent
        }
    };

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
                    <button
                        type="button"
                        className="absolute btn btn-sm btn-circle btn-ghost right-2 top-2"
                        onClick={handleClose}
                    >
                        ✕
                    </button>
                    <h3 className="text-lg font-bold">{title}</h3>
                    <div className="pt-4">{children}</div>
                </div>
            </dialog>
        </>
    );
}
