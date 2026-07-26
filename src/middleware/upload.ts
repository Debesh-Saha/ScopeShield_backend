import multer from "multer";
import path from "path";
import fs from "fs";

const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

//This tells Multer WHERE to save uploaded files and WHAT their filenames should be.
const storage = multer.diskStorage({
    // Decide which folder to store the uploaded file in
    destination(req, file, cb) {
        let dir: string;

        // Original scope (PDF, TXT, Screenshot etc.)
        if (file.fieldname === "scopeDocument") {
            dir = "uploads/scope-documents";
        }

        // New client conversation
        else if (file.fieldname === "chat") {
            dir = "uploads/chats";
        }

        // Any unknown field is rejected
        else {
            return cb(new Error("Invalid upload field"), "");
        }

        ensureDir(dir);
        cb(null, dir);
    },

    // Rename the uploaded file to prevent duplication
    filename(req, file, cb) {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 100000) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

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