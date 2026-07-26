import multer from "multer";
import path from "path";
import fs from "fs";

const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const storage = multer.diskStorage({
    destination(req, file, cb) {
        let dir: string;

        if (file.fieldname === "scopeDocument") {
            dir = "uploads/scope-documents";
        } else if (file.fieldname === "chat") {
            dir = "uploads/chats";
        } else {
            return cb(new Error("Invalid upload field"), "");
        }

        ensureDir(dir);
        cb(null, dir);
    },

    filename(req, file, cb) {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 100000) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});