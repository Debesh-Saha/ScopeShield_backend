import multer from "multer";

const storage = multer.memoryStorage();

//File Validation: Decide which file types are allowed.
const fileFilter: multer.Options["fileFilter"] = (req, file, cb) => {
    // Scope Document
    if (file.fieldname === "scopeDocument") {
        const allowedTypes = [
            "application/pdf",
            "text/plain",
            "image/png",
            "image/jpeg",
            "image/jpg",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(
                new Error(
                    "Scope document must be PDF, TXT, PNG, JPG, DOC or DOCX."
                )
            );

        }

    }

    // Chat Upload
    else if (file.fieldname === "chat") {
        const allowedTypes = [
            "text/plain",
            "image/png",
            "image/jpeg",
            "image/jpg"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(
                new Error(
                    "Chat must be TXT, PNG or JPG."
                )
            );

        }

    }

    // Unknown upload field
    else {
        return cb(new Error("Invalid upload field"));
    }

    // Everything is valid
    cb(null, true);
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        // Maximum file size = 10 MB
        fileSize: 10 * 1024 * 1024
    }
});
