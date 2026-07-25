import fs from "fs";
import FormData from "form-data";

interface UploadedFile {
    fileName: string;
    filePath: string;
    originalName: string;
    mimeType: string;
}

export const analyzeScope = async (
    scopeDocuments: UploadedFile[],
    chatFiles: UploadedFile[]
) => {

    const form = new FormData();

    scopeDocuments.forEach(file => {
        form.append(
            "contract_files",
            fs.createReadStream(file.filePath),
            {
                filename: file.originalName,
                contentType: file.mimeType
            }
        );
    });

    chatFiles.forEach(file => {
        form.append(
            "chat_logs",
            fs.createReadStream(file.filePath),
            {
                filename: file.originalName,
                contentType: file.mimeType
            }
        );
    });

    const response = await fetch(
        `${process.env.AI_SERVICE_URL}/analyze`,
        {
            method: "POST",
            headers: form.getHeaders() as any,
            body: form as any
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
    }

    return await response.json();
};