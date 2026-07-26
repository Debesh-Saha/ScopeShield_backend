import { readFile } from "fs/promises";

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

    for (const file of scopeDocuments) {
        const buffer = await readFile(file.filePath);
        form.append(
            "contract_files",
            new Blob([buffer], { type: file.mimeType }),
            file.originalName
        );
    }

    for (const file of chatFiles) {
        const buffer = await readFile(file.filePath);
        form.append(
            "chat_logs",
            new Blob([buffer], { type: file.mimeType }),
            file.originalName
        );
    }

    const response = await fetch(
        `${process.env.AI_SERVICE_URL}/analyze`,
        {
            method: "POST",
            body: form
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
    }

    return await response.json();
};